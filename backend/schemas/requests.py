from __future__ import annotations

from typing import Literal
from pydantic import BaseModel, Field


RoleType = Literal["USER", "ADMIN", "UTILITY_OPERATOR"]
RequestStatus = Literal["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]
BillStatus = Literal["PAID", "UNPAID"]


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: str = Field(min_length=5, max_length=150)
    password: str = Field(min_length=6, max_length=128)
    smart_meter_id: str = Field(min_length=2, max_length=60)


class LoginRequest(BaseModel):
    email: str = Field(min_length=5, max_length=150)
    password: str


class PaymentRequest(BaseModel):
    bill_id: str
    amount: float = Field(gt=0)
    payment_method: str = Field(min_length=2, max_length=40)


class ServiceRequestCreate(BaseModel):
    request_type: str = Field(min_length=3, max_length=60)
    description: str = Field(min_length=5, max_length=500)


class ServiceStatusUpdate(BaseModel):
    status: RequestStatus
    note: str = Field(min_length=2, max_length=200)


class SubscriptionActivateRequest(BaseModel):
    plan_name: str = Field(min_length=2, max_length=80)


class ConsumptionCalculatorRequest(BaseModel):
    appliance_type: str = Field(min_length=2, max_length=80)
    power_rating_watts: float = Field(gt=0)
    usage_hours_per_day: float = Field(gt=0, le=24)
    tariff_per_kwh: float | None = Field(default=None, gt=0)


class HelpContactRequest(BaseModel):
    subject: str = Field(min_length=3, max_length=120)
    message: str = Field(min_length=8, max_length=800)


class AdminBillGenerateRequest(BaseModel):
    user_id: str
    billing_month: str = Field(pattern=r"^\d{4}-\d{2}$")
    units_consumed: float = Field(gt=0)
    due_date: str


class ChatQueryRequest(BaseModel):
    message: str = Field(min_length=2, max_length=1200)
    session_id: str | None = Field(default=None, max_length=100)


class BalanceTopupRequest(BaseModel):
    amount: float = Field(gt=0)
    payment_method: str = Field(default="UPI", min_length=2, max_length=40)


class BalanceForecastRequest(BaseModel):
    recharge_amount: float | None = Field(default=None, ge=0)
