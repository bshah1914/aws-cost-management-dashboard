from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


# --- Auth ---
class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


# --- User ---
class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=100)
    password: str = Field(..., min_length=6)
    is_admin: bool = False
    account_ids: List[int] = []


class UserUpdate(BaseModel):
    is_active: Optional[bool] = None
    account_ids: Optional[List[int]] = None


class UserOut(BaseModel):
    id: int
    username: str
    is_admin: bool
    is_active: bool
    login_attempts: int
    created_at: datetime
    account_ids: List[int] = []

    class Config:
        from_attributes = True


class UserDetailOut(UserOut):
    plain_password: Optional[str] = None


class PasswordReset(BaseModel):
    new_password: str = Field(..., min_length=6)


# --- AWS Account ---
class AWSAccountCreate(BaseModel):
    account_id: str = Field(..., min_length=12, max_length=12)
    account_name: str
    is_root: bool = False
    access_key: str
    secret_key: str
    region: str = "us-east-1"


class AWSAccountUpdate(BaseModel):
    account_name: Optional[str] = None
    access_key: Optional[str] = None
    secret_key: Optional[str] = None
    region: Optional[str] = None
    is_active: Optional[bool] = None


class AWSAccountOut(BaseModel):
    id: int
    account_id: str
    account_name: str
    is_root: bool
    region: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# --- Session ---
class SessionOut(BaseModel):
    id: int
    user_id: int
    ip_address: Optional[str]
    browser: Optional[str]
    created_at: datetime
    last_activity: datetime
    is_active: bool

    class Config:
        from_attributes = True


# --- Login History ---
class LoginHistoryOut(BaseModel):
    id: int
    user_id: int
    ip_address: Optional[str]
    browser: Optional[str]
    success: bool
    timestamp: datetime

    class Config:
        from_attributes = True


# --- Cost Dashboard ---
class DateFilter(BaseModel):
    start_date: str  # YYYY-MM-DD
    end_date: str    # YYYY-MM-DD
    granularity: str = "MONTHLY"  # DAILY, MONTHLY
    account_ids: Optional[List[str]] = None


class CostData(BaseModel):
    date: str
    amount: float
    currency: str = "USD"


class ServiceCost(BaseModel):
    service: str
    cost: float
    previous_cost: Optional[float] = None
    change_percent: Optional[float] = None


class CostOverview(BaseModel):
    total_cost: float
    currency: str = "USD"
    previous_period_cost: Optional[float] = None
    change_percent: Optional[float] = None
    daily_costs: List[CostData] = []
    service_costs: List[ServiceCost] = []


# --- Forecast ---
class ForecastRequest(BaseModel):
    months_ahead: int = Field(default=3, ge=1, le=6)
    account_ids: Optional[List[str]] = None
    granularity: str = "MONTHLY"


class ForecastData(BaseModel):
    date: str
    mean_value: float
    prediction_interval_lower: float
    prediction_interval_upper: float


# --- Compute Optimizer ---
class OptimizationRecommendation(BaseModel):
    resource_id: str
    resource_type: str
    resource_name: Optional[str] = None
    account_id: str
    finding: str
    current_config: dict = {}
    recommended_config: dict = {}
    estimated_monthly_savings: float = 0.0
    performance_risk: Optional[str] = None


# --- Anomaly ---
class AnomalyData(BaseModel):
    anomaly_id: str
    account_id: Optional[str] = None
    service: Optional[str] = None
    start_date: str
    end_date: str
    expected_spend: float
    actual_spend: float
    impact: float
    root_causes: List[dict] = []


# --- Cost Optimization Hub ---
class SavingsOpportunity(BaseModel):
    recommendation_id: str
    resource_id: Optional[str] = None
    resource_type: str
    account_id: str
    action_type: str
    estimated_monthly_savings: float
    estimated_savings_percentage: float = 0.0
    description: str
    implementation_effort: Optional[str] = None


# ---- News ---
class NewsItem(BaseModel):
    title: str
    link: str
    published: Optional[str] = None
    summary: Optional[str] = None
    category: Optional[str] = None
