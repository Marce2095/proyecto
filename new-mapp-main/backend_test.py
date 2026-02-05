import requests
import sys
import json
from datetime import datetime

class POSSystemTester:
    def __init__(self, base_url="https://quicksale-pos-3.preview.emergentagent.com"):
        self.base_url = base_url
        self.admin_token = None
        self.cashier_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.created_product_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, token=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = f'Bearer {token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=data)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json() if response.text else {}
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    print(f"Response: {response.text}")
                except:
                    pass
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_admin_login(self):
        """Test admin login"""
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data={"email": "admin@pos.com", "password": "admin123"}
        )
        if success and 'access_token' in response:
            self.admin_token = response['access_token']
            print(f"Admin user: {response.get('user', {}).get('name', 'Unknown')}")
            return True
        return False

    def test_cashier_login(self):
        """Test cashier login"""
        success, response = self.run_test(
            "Cashier Login",
            "POST",
            "auth/login",
            200,
            data={"email": "cashier@pos.com", "password": "cashier123"}
        )
        if success and 'access_token' in response:
            self.cashier_token = response['access_token']
            print(f"Cashier user: {response.get('user', {}).get('name', 'Unknown')}")
            return True
        return False

    def test_invalid_login(self):
        """Test login with invalid credentials"""
        success, _ = self.run_test(
            "Invalid Login",
            "POST",
            "auth/login",
            401,
            data={"email": "invalid@pos.com", "password": "wrongpass"}
        )
        return success

    def test_get_top_products(self):
        """Test getting top 9 products"""
        success, response = self.run_test(
            "Get Top Products",
            "GET",
            "products/top?limit=9",
            200,
            token=self.admin_token
        )
        if success:
            products = response if isinstance(response, list) else []
            print(f"Found {len(products)} top products")
            return len(products) <= 9
        return False

    def test_get_products_by_category(self):
        """Test filtering products by category"""
        categories = ["cold_drinks", "hot_drinks", "snacks"]
        all_passed = True
        
        for category in categories:
            success, response = self.run_test(
                f"Get Products - {category}",
                "GET",
                f"products?category={category}",
                200,
                token=self.admin_token
            )
            if success:
                products = response if isinstance(response, list) else []
                print(f"Found {len(products)} products in {category}")
            else:
                all_passed = False
        
        return all_passed

    def test_search_products(self):
        """Test product search functionality"""
        success, response = self.run_test(
            "Search Products",
            "GET",
            "products?search=coffee",
            200,
            token=self.admin_token
        )
        if success:
            products = response if isinstance(response, list) else []
            print(f"Found {len(products)} products matching 'coffee'")
            return True
        return False

    def test_create_product_admin(self):
        """Test creating a product as admin"""
        product_data = {
            "name": "Test Product",
            "category": "snacks",
            "cost": 1.50,
            "sale_price": 3.00,
            "image_url": "https://via.placeholder.com/400"
        }
        
        success, response = self.run_test(
            "Create Product (Admin)",
            "POST",
            "products",
            200,
            data=product_data,
            token=self.admin_token
        )
        
        if success and 'id' in response:
            self.created_product_id = response['id']
            print(f"Created product with ID: {self.created_product_id}")
            return True
        return False

    def test_create_product_cashier_forbidden(self):
        """Test that cashier cannot create products"""
        product_data = {
            "name": "Forbidden Product",
            "category": "snacks",
            "cost": 1.00,
            "sale_price": 2.00
        }
        
        success, _ = self.run_test(
            "Create Product (Cashier - Should Fail)",
            "POST",
            "products",
            403,
            data=product_data,
            token=self.cashier_token
        )
        return success

    def test_update_product(self):
        """Test updating a product"""
        if not self.created_product_id:
            print("❌ No product ID available for update test")
            return False
            
        update_data = {
            "name": "Updated Test Product",
            "sale_price": 3.50
        }
        
        success, response = self.run_test(
            "Update Product",
            "PUT",
            f"products/{self.created_product_id}",
            200,
            data=update_data,
            token=self.admin_token
        )
        return success

    def test_create_sale(self):
        """Test creating a sale"""
        # First get a product to sell
        success, products = self.run_test(
            "Get Products for Sale",
            "GET",
            "products/top?limit=1",
            200,
            token=self.cashier_token
        )
        
        if not success or not products:
            print("❌ No products available for sale test")
            return False
            
        product = products[0]
        sale_data = {
            "products": [{
                "product_id": product["id"],
                "product_name": product["name"],
                "quantity": 2,
                "unit_price": product["sale_price"],
                "subtotal": product["sale_price"] * 2
            }],
            "total": product["sale_price"] * 2
        }
        
        success, response = self.run_test(
            "Create Sale",
            "POST",
            "sales",
            200,
            data=sale_data,
            token=self.cashier_token
        )
        
        if success:
            print(f"Sale created with total: ${response.get('total', 0)}")
        return success

    def test_get_sales_history(self):
        """Test getting sales history"""
        success, response = self.run_test(
            "Get Sales History",
            "GET",
            "sales",
            200,
            token=self.admin_token
        )
        
        if success:
            sales = response if isinstance(response, list) else []
            print(f"Found {len(sales)} sales in history")
        return success

    def test_get_reports(self):
        """Test getting reports for different periods"""
        periods = ["daily", "weekly", "monthly", "yearly"]
        all_passed = True
        
        for period in periods:
            success, response = self.run_test(
                f"Get Report - {period}",
                "GET",
                f"reports/summary?period={period}",
                200,
                token=self.admin_token
            )
            
            if success:
                print(f"Report data: Total sales: ${response.get('total_sales', 0)}, Transactions: {response.get('total_transactions', 0)}")
            else:
                all_passed = False
        
        return all_passed

    def test_delete_product(self):
        """Test deleting a product"""
        if not self.created_product_id:
            print("❌ No product ID available for delete test")
            return False
            
        success, _ = self.run_test(
            "Delete Product",
            "DELETE",
            f"products/{self.created_product_id}",
            200,
            token=self.admin_token
        )
        return success

    def test_seed_endpoint(self):
        """Test the seed endpoint"""
        success, response = self.run_test(
            "Seed Database",
            "POST",
            "seed",
            200
        )
        
        if success:
            print(f"Seed response: {response.get('message', 'No message')}")
        return success

def main():
    print("🚀 Starting POS System Backend Tests")
    print("=" * 50)
    
    tester = POSSystemTester()
    
    # Test authentication
    print("\n📋 AUTHENTICATION TESTS")
    if not tester.test_admin_login():
        print("❌ Admin login failed, stopping tests")
        return 1
    
    if not tester.test_cashier_login():
        print("❌ Cashier login failed, stopping tests")
        return 1
    
    tester.test_invalid_login()
    
    # Test product operations
    print("\n📋 PRODUCT TESTS")
    tester.test_get_top_products()
    tester.test_get_products_by_category()
    tester.test_search_products()
    
    # Test admin operations
    print("\n📋 ADMIN OPERATIONS")
    tester.test_create_product_admin()
    tester.test_create_product_cashier_forbidden()
    tester.test_update_product()
    
    # Test sales operations
    print("\n📋 SALES TESTS")
    tester.test_create_sale()
    tester.test_get_sales_history()
    
    # Test reports
    print("\n📋 REPORTS TESTS")
    tester.test_get_reports()
    
    # Cleanup
    print("\n📋 CLEANUP")
    tester.test_delete_product()
    
    # Test seed (should already be seeded)
    print("\n📋 SEED TEST")
    tester.test_seed_endpoint()
    
    # Print results
    print("\n" + "=" * 50)
    print(f"📊 Tests completed: {tester.tests_passed}/{tester.tests_run}")
    success_rate = (tester.tests_passed / tester.tests_run * 100) if tester.tests_run > 0 else 0
    print(f"📈 Success rate: {success_rate:.1f}%")
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())