from fastapi import FastAPI, APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
from jose import JWTError, jwt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

SECRET_KEY = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if user is None:
        raise credentials_exception
    return user

async def get_admin_user(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    name: str
    role: str = "cashier"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "cashier"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: User

class Product(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    category: str
    cost: float
    sale_price: float
    employee_price: float = 0.0
    image_url: str = ""
    times_sold: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ProductCreate(BaseModel):
    name: str
    category: str
    cost: float
    sale_price: float
    employee_price: float = 0.0
    image_url: str = ""

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    cost: Optional[float] = None
    sale_price: Optional[float] = None
    employee_price: Optional[float] = None
    image_url: Optional[str] = None

class SaleProduct(BaseModel):
    product_id: str
    product_name: str
    quantity: int
    unit_price: float
    subtotal: float

class Sale(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    products: List[SaleProduct]
    total: float
    customer_type: str = "customer"
    payment_method: str = "cash"
    amount_paid: float = 0.0
    change_amount: float = 0.0
    cashier_id: str
    cashier_name: str
    date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SaleCreate(BaseModel):
    products: List[SaleProduct]
    total: float
    customer_type: str = "customer"
    payment_method: str = "cash"
    amount_paid: float = 0.0
    change_amount: float = 0.0

class ReportSummary(BaseModel):
    model_config = ConfigDict(extra="ignore")
    total_sales: float
    total_transactions: int
    top_products: List[dict]
    sales_by_category: dict
    daily_sales: List[dict]

@api_router.post("/auth/register", response_model=User)
async def register(user_data: UserCreate):
    existing_user = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = get_password_hash(user_data.password)
    user_dict = user_data.model_dump()
    user_dict.pop("password")
    user_obj = User(**user_dict)
    
    doc = user_obj.model_dump()
    doc["password"] = hashed_password
    doc["created_at"] = doc["created_at"].isoformat()
    
    await db.users.insert_one(doc)
    return user_obj

@api_router.post("/auth/login", response_model=Token)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    access_token = create_access_token(data={"sub": user["id"]})
    user.pop("password")
    if isinstance(user["created_at"], str):
        user["created_at"] = datetime.fromisoformat(user["created_at"])
    
    return Token(access_token=access_token, token_type="bearer", user=User(**user))

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: dict = Depends(get_current_user)):
    if isinstance(current_user["created_at"], str):
        current_user["created_at"] = datetime.fromisoformat(current_user["created_at"])
    return User(**current_user)

@api_router.get("/products", response_model=List[Product])
async def get_products(category: Optional[str] = None, search: Optional[str] = None):
    query = {}
    if category:
        query["category"] = category
    if search:
        query["name"] = {"$regex": search, "$options": "i"}
    
    products = await db.products.find(query, {"_id": 0}).to_list(1000)
    for p in products:
        if isinstance(p["created_at"], str):
            p["created_at"] = datetime.fromisoformat(p["created_at"])
    return products

@api_router.get("/products/top", response_model=List[Product])
async def get_top_products(limit: int = 9):
    products = await db.products.find({}, {"_id": 0}).sort("times_sold", -1).limit(limit).to_list(limit)
    for p in products:
        if isinstance(p["created_at"], str):
            p["created_at"] = datetime.fromisoformat(p["created_at"])
    return products

@api_router.post("/products", response_model=Product)
async def create_product(product: ProductCreate, current_user: dict = Depends(get_admin_user)):
    product_obj = Product(**product.model_dump())
    doc = product_obj.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.products.insert_one(doc)
    return product_obj

@api_router.put("/products/{product_id}", response_model=Product)
async def update_product(product_id: str, product: ProductUpdate, current_user: dict = Depends(get_admin_user)):
    existing = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Product not found")
    
    update_data = {k: v for k, v in product.model_dump().items() if v is not None}
    if update_data:
        await db.products.update_one({"id": product_id}, {"$set": update_data})
    
    updated = await db.products.find_one({"id": product_id}, {"_id": 0})
    if isinstance(updated["created_at"], str):
        updated["created_at"] = datetime.fromisoformat(updated["created_at"])
    return Product(**updated)

@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str, current_user: dict = Depends(get_admin_user)):
    result = await db.products.delete_one({"id": product_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"message": "Product deleted"}

@api_router.post("/sales", response_model=Sale)
async def create_sale(sale_data: SaleCreate, current_user: dict = Depends(get_current_user)):
    sale_obj = Sale(
        **sale_data.model_dump(),
        cashier_id=current_user["id"],
        cashier_name=current_user["name"]
    )
    
    doc = sale_obj.model_dump()
    doc["date"] = doc["date"].isoformat()
    await db.sales.insert_one(doc)
    
    for item in sale_data.products:
        await db.products.update_one(
            {"id": item.product_id},
            {"$inc": {"times_sold": item.quantity}}
        )
    
    return sale_obj

@api_router.get("/sales", response_model=List[Sale])
async def get_sales(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if start_date:
        query["date"] = {"$gte": start_date}
    if end_date:
        if "date" not in query:
            query["date"] = {}
        query["date"]["$lte"] = end_date
    
    sales = await db.sales.find(query, {"_id": 0}).sort("date", -1).to_list(1000)
    for s in sales:
        if isinstance(s["date"], str):
            s["date"] = datetime.fromisoformat(s["date"])
    return sales

@api_router.get("/reports/summary", response_model=ReportSummary)
async def get_report_summary(
    period: str = "daily",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    now = datetime.now(timezone.utc)
    
    if not start_date:
        if period == "daily":
            start_date = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        elif period == "weekly":
            start_date = (now - timedelta(days=7)).isoformat()
        elif period == "monthly":
            start_date = (now - timedelta(days=30)).isoformat()
        elif period == "yearly":
            start_date = (now - timedelta(days=365)).isoformat()
    
    if start_date:
        query["date"] = {"$gte": start_date}
    if end_date:
        if "date" not in query:
            query["date"] = {}
        query["date"]["$lte"] = end_date
    
    sales = await db.sales.find(query, {"_id": 0}).to_list(10000)
    
    total_sales = sum(s["total"] for s in sales)
    total_transactions = len(sales)
    
    product_sales = {}
    category_sales = {}
    daily_totals = {}
    
    for sale in sales:
        sale_date = sale["date"]
        if isinstance(sale_date, str):
            sale_date = datetime.fromisoformat(sale_date)
        day_key = sale_date.strftime("%Y-%m-%d")
        daily_totals[day_key] = daily_totals.get(day_key, 0) + sale["total"]
        
        for item in sale["products"]:
            pid = item["product_id"]
            if pid not in product_sales:
                product_sales[pid] = {
                    "product_id": pid,
                    "product_name": item["product_name"],
                    "quantity": 0,
                    "revenue": 0
                }
            product_sales[pid]["quantity"] += item["quantity"]
            product_sales[pid]["revenue"] += item["subtotal"]
    
    for pid, data in product_sales.items():
        product = await db.products.find_one({"id": pid}, {"_id": 0})
        if product:
            category = product["category"]
            category_sales[category] = category_sales.get(category, 0) + data["revenue"]
    
    top_products = sorted(product_sales.values(), key=lambda x: x["quantity"], reverse=True)[:10]
    
    daily_sales_list = [{"date": k, "total": v} for k, v in sorted(daily_totals.items())]
    
    return ReportSummary(
        total_sales=total_sales,
        total_transactions=total_transactions,
        top_products=top_products,
        sales_by_category=category_sales,
        daily_sales=daily_sales_list
    )

@api_router.get("/users", response_model=List[User])
async def get_users(current_user: dict = Depends(get_admin_user)):
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(1000)
    for u in users:
        if isinstance(u["created_at"], str):
            u["created_at"] = datetime.fromisoformat(u["created_at"])
    return users

@api_router.post("/seed", response_model=dict)
async def seed_data():
    existing_products = await db.products.count_documents({})
    if existing_products > 0:
        return {"message": "Database already seeded"}
    
    cold_drinks = [
        {"name": "Iced Coffee", "cost": 1.50, "sale_price": 3.50, "employee_price": 2.50, "image_url": "https://images.unsplash.com/photo-1686575669781-74e03080541b?w=400"},
        {"name": "Iced Latte", "cost": 1.80, "sale_price": 4.00, "employee_price": 3.00, "image_url": "https://images.unsplash.com/photo-1517487881594-2787fef5ebf7?w=400"},
        {"name": "Cold Brew", "cost": 1.60, "sale_price": 3.75, "employee_price": 2.75, "image_url": "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400"},
        {"name": "Iced Mocha", "cost": 2.00, "sale_price": 4.50, "employee_price": 3.25, "image_url": "https://images.unsplash.com/photo-1542843137-8791a6904d14?w=400"},
        {"name": "Iced Caramel Macchiato", "cost": 2.20, "sale_price": 4.75, "employee_price": 3.50, "image_url": "https://images.unsplash.com/photo-1599578675144-ba7ef5e19186?w=400"},
        {"name": "Iced Vanilla Latte", "cost": 1.90, "sale_price": 4.25, "employee_price": 3.00, "image_url": "https://images.unsplash.com/photo-1602882480284-ad6a30ba4f07?w=400"},
        {"name": "Strawberry Smoothie", "cost": 2.50, "sale_price": 5.50, "employee_price": 4.00, "image_url": "https://images.unsplash.com/photo-1622597468620-656aa1f981ea?w=400"},
        {"name": "Mango Smoothie", "cost": 2.50, "sale_price": 5.50, "employee_price": 4.00, "image_url": "https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=400"},
        {"name": "Berry Blast Smoothie", "cost": 2.70, "sale_price": 5.75, "employee_price": 4.25, "image_url": "https://images.unsplash.com/photo-1505252585461-04db1eb84625?w=400"},
        {"name": "Green Detox Smoothie", "cost": 2.80, "sale_price": 6.00, "employee_price": 4.50, "image_url": "https://images.unsplash.com/photo-1610970881699-44a5587cabec?w=400"},
        {"name": "Lemonade", "cost": 1.00, "sale_price": 2.50, "employee_price": 1.75, "image_url": "https://images.unsplash.com/photo-1523677011781-c91d1bbe4d1e?w=400"},
        {"name": "Orange Juice", "cost": 1.20, "sale_price": 3.00, "employee_price": 2.00, "image_url": "https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=400"},
        {"name": "Apple Juice", "cost": 1.20, "sale_price": 3.00, "employee_price": 2.00, "image_url": "https://images.unsplash.com/photo-1609501676725-7186f017a4b7?w=400"},
        {"name": "Iced Tea", "cost": 0.80, "sale_price": 2.25, "employee_price": 1.50, "image_url": "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400"},
        {"name": "Peach Iced Tea", "cost": 1.00, "sale_price": 2.75, "employee_price": 2.00, "image_url": "https://images.unsplash.com/photo-1499638309848-e9968540da83?w=400"},
        {"name": "Mint Lemonade", "cost": 1.30, "sale_price": 3.25, "employee_price": 2.25, "image_url": "https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=400"},
        {"name": "Coconut Water", "cost": 1.50, "sale_price": 3.50, "employee_price": 2.50, "image_url": "https://images.unsplash.com/photo-1605367587000-15a5d37715e4?w=400"},
        {"name": "Watermelon Juice", "cost": 1.40, "sale_price": 3.25, "employee_price": 2.25, "image_url": "https://images.unsplash.com/photo-1587049633312-d628ae50a8ae?w=400"},
        {"name": "Pineapple Juice", "cost": 1.30, "sale_price": 3.00, "employee_price": 2.00, "image_url": "https://images.unsplash.com/photo-1565299543923-37dd37887442?w=400"},
        {"name": "Frappuccino", "cost": 2.40, "sale_price": 5.25, "employee_price": 3.75, "image_url": "https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=400"},
        {"name": "Chocolate Shake", "cost": 2.30, "sale_price": 5.00, "employee_price": 3.50, "image_url": "https://images.unsplash.com/photo-1542574271-7f3b92e6c821?w=400"},
        {"name": "Vanilla Shake", "cost": 2.20, "sale_price": 4.75, "employee_price": 3.25, "image_url": "https://images.unsplash.com/photo-1579954115545-a95591f28bfc?w=400"},
        {"name": "Strawberry Shake", "cost": 2.30, "sale_price": 5.00, "employee_price": 3.50, "image_url": "https://images.unsplash.com/photo-1623428454614-abaf00244e52?w=400"},
        {"name": "Oreo Shake", "cost": 2.50, "sale_price": 5.50, "employee_price": 4.00, "image_url": "https://images.unsplash.com/photo-1581006852262-e4307cf6283a?w=400"},
        {"name": "Bubble Tea", "cost": 2.00, "sale_price": 4.50, "employee_price": 3.25, "image_url": "https://images.unsplash.com/photo-1525385133512-2f3bdd039054?w=400"},
    ]
    
    hot_drinks = [
        {"name": "Hot Coffee", "cost": 1.00, "sale_price": 2.50, "employee_price": 1.75, "image_url": "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400"},
        {"name": "Espresso", "cost": 0.80, "sale_price": 2.00, "employee_price": 1.50, "image_url": "https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=400"},
        {"name": "Cappuccino", "cost": 1.40, "sale_price": 3.50, "employee_price": 2.50, "image_url": "https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=400"},
        {"name": "Latte", "cost": 1.50, "sale_price": 3.75, "employee_price": 2.75, "image_url": "https://images.unsplash.com/photo-1691723247105-57e32577dc72?w=400"},
        {"name": "Americano", "cost": 1.20, "sale_price": 3.00, "employee_price": 2.00, "image_url": "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400"},
        {"name": "Mocha", "cost": 1.80, "sale_price": 4.25, "employee_price": 3.00, "image_url": "https://images.unsplash.com/photo-1578374173704-966697ae5e8c?w=400"},
        {"name": "Macchiato", "cost": 1.60, "sale_price": 3.75, "employee_price": 2.75, "image_url": "https://images.unsplash.com/photo-1557006021-b85faa2bc5e2?w=400"},
        {"name": "Hot Chocolate", "cost": 1.50, "sale_price": 3.50, "employee_price": 2.50, "image_url": "https://images.unsplash.com/photo-1542990253-0d0f5be5f0ed?w=400"},
        {"name": "Chai Latte", "cost": 1.60, "sale_price": 3.75, "employee_price": 2.75, "image_url": "https://images.unsplash.com/photo-1578374173704-966697ae5e8c?w=400"},
        {"name": "Matcha Latte", "cost": 2.00, "sale_price": 4.50, "employee_price": 3.25, "image_url": "https://images.unsplash.com/photo-1536013080062-84d3e4fcf21f?w=400"},
        {"name": "Green Tea", "cost": 0.60, "sale_price": 2.00, "employee_price": 1.50, "image_url": "https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=400"},
        {"name": "Peppermint Tea", "cost": 0.70, "sale_price": 2.25, "employee_price": 1.75, "image_url": "https://images.unsplash.com/photo-1597318110274-1f1335e0a83d?w=400"},
    ]
    
    snacks = [
        {"name": "Croissant", "cost": 1.20, "sale_price": 3.00, "employee_price": 2.00, "image_url": "https://images.unsplash.com/photo-1709798289100-7b46217e0325?w=400"},
        {"name": "Chocolate Croissant", "cost": 1.40, "sale_price": 3.50, "employee_price": 2.50, "image_url": "https://images.unsplash.com/photo-1632636575859-45d1950fdc78?w=400"},
        {"name": "Blueberry Muffin", "cost": 1.00, "sale_price": 2.75, "employee_price": 2.00, "image_url": "https://images.unsplash.com/photo-1607958996333-41aef7caefaa?w=400"},
        {"name": "Chocolate Chip Muffin", "cost": 1.00, "sale_price": 2.75, "employee_price": 2.00, "image_url": "https://images.pexels.com/photos/3650437/pexels-photo-3650437.jpeg?w=400"},
        {"name": "Cinnamon Roll", "cost": 1.30, "sale_price": 3.50, "employee_price": 2.50, "image_url": "https://images.unsplash.com/photo-1509365465985-25d11c17e812?w=400"},
        {"name": "Bagel", "cost": 0.80, "sale_price": 2.50, "employee_price": 1.75, "image_url": "https://images.unsplash.com/photo-1549931319-a545dcf3bc3c?w=400"},
        {"name": "Sandwich", "cost": 2.50, "sale_price": 6.00, "employee_price": 4.50, "image_url": "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400"},
        {"name": "Cookies", "cost": 0.60, "sale_price": 1.75, "employee_price": 1.25, "image_url": "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=400"},
        {"name": "Brownie", "cost": 1.20, "sale_price": 3.00, "employee_price": 2.00, "image_url": "https://images.unsplash.com/photo-1607920591413-4ec007e70023?w=400"},
        {"name": "Cheesecake", "cost": 2.00, "sale_price": 5.00, "employee_price": 3.50, "image_url": "https://images.unsplash.com/photo-1524351199678-941a58a3df50?w=400"},
        {"name": "Donut", "cost": 0.80, "sale_price": 2.00, "employee_price": 1.50, "image_url": "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400"},
    ]    
    extras = [
        {"name": "Leche Extra", "cost": 0.30, "sale_price": 0.75, "employee_price": 0.50, "image_url": "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400"},
        {"name": "Shot Espresso", "cost": 0.50, "sale_price": 1.00, "employee_price": 0.75, "image_url": "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400"},
        {"name": "Crema Batida", "cost": 0.40, "sale_price": 1.00, "employee_price": 0.75, "image_url": "https://images.unsplash.com/photo-1625772452859-1c03d5bf1137?w=400"},
        {"name": "Jarabe Vainilla", "cost": 0.30, "sale_price": 0.75, "employee_price": 0.50, "image_url": "https://images.unsplash.com/photo-1481391032119-d89fee407e44?w=400"},
        {"name": "Jarabe Caramelo", "cost": 0.30, "sale_price": 0.75, "employee_price": 0.50, "image_url": "https://images.unsplash.com/photo-1481391032119-d89fee407e44?w=400"},
        {"name": "Jarabe Avellana", "cost": 0.30, "sale_price": 0.75, "employee_price": 0.50, "image_url": "https://images.unsplash.com/photo-1481391032119-d89fee407e44?w=400"},
        {"name": "Chocolate Extra", "cost": 0.40, "sale_price": 1.00, "employee_price": 0.75, "image_url": "https://images.unsplash.com/photo-1511381939415-e44015466834?w=400"},
        {"name": "Leche de Almendra", "cost": 0.50, "sale_price": 1.25, "employee_price": 1.00, "image_url": "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400"},
        {"name": "Leche de Avena", "cost": 0.50, "sale_price": 1.25, "employee_price": 1.00, "image_url": "https://images.unsplash.com/photo-1600788907416-456578634209?w=400"},
        {"name": "Topping Oreo", "cost": 0.50, "sale_price": 1.25, "employee_price": 1.00, "image_url": "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=400"},
    ]
    
    products_to_insert = []
    
    for drink in cold_drinks:
        product = Product(
            name=drink["name"],
            category="cold_drinks",
            cost=drink["cost"],
            sale_price=drink["sale_price"],
            employee_price=drink.get("employee_price", 0),
            image_url=drink["image_url"],
            times_sold=0
        )
        doc = product.model_dump()
        doc["created_at"] = doc["created_at"].isoformat()
        products_to_insert.append(doc)
    
    for drink in hot_drinks:
        product = Product(
            name=drink["name"],
            category="hot_drinks",
            cost=drink["cost"],
            sale_price=drink["sale_price"],
            employee_price=drink.get("employee_price", 0),
            image_url=drink["image_url"],
            times_sold=0
        )
        doc = product.model_dump()
        doc["created_at"] = doc["created_at"].isoformat()
        products_to_insert.append(doc)
    
    for snack in snacks:
        product = Product(
            name=snack["name"],
            category="snacks",
            cost=snack["cost"],
            sale_price=snack["sale_price"],
            employee_price=snack.get("employee_price", 0),
            image_url=snack["image_url"],
            times_sold=0
        )
        doc = product.model_dump()
        doc["created_at"] = doc["created_at"].isoformat()
        products_to_insert.append(doc)
    
    for extra in extras:
        product = Product(
            name=extra["name"],
            category="extras",
            cost=extra["cost"],
            sale_price=extra["sale_price"],
            employee_price=extra.get("employee_price", 0),
            image_url=extra["image_url"],
            times_sold=0
        )
        doc = product.model_dump()
        doc["created_at"] = doc["created_at"].isoformat()
        products_to_insert.append(doc)
    
    if products_to_insert:
        await db.products.insert_many(products_to_insert)
    
    admin_user = User(
        email="admin@pos.com",
        name="Admin User",
        role="admin"
    )
    admin_doc = admin_user.model_dump()
    admin_doc["password"] = get_password_hash("admin123")
    admin_doc["created_at"] = admin_doc["created_at"].isoformat()
    await db.users.insert_one(admin_doc)
    
    cashier_user = User(
        email="cashier@pos.com",
        name="Cashier User",
        role="cashier"
    )
    cashier_doc = cashier_user.model_dump()
    cashier_doc["password"] = get_password_hash("cashier123")
    cashier_doc["created_at"] = cashier_doc["created_at"].isoformat()
    await db.users.insert_one(cashier_doc)
    
    return {
        "message": "Database seeded successfully",
        "products_count": len(products_to_insert),
        "users_created": 2
    }

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()