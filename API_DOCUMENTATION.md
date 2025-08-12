# Cheff Guio Backend API Documentation

## Base URL
- Development: `http://localhost:3001`
- Production: `https://api.cheffguio.com`

## Authentication
All protected endpoints require a Bearer token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Endpoints

### Authentication

#### POST /api/auth/login
Login with email and password
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

#### POST /api/auth/register
Register new user and restaurant
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "User Name",
  "restaurantName": "Restaurant Name",
  "phone": "(11) 99999-9999"
}
```

#### GET /api/auth/me
Get current user profile and restaurant data

### Restaurants

#### GET /api/restaurants
Get all restaurants (public)

#### GET /api/restaurants/my
Get current user's restaurant (authenticated)

#### GET /api/restaurants/user/:userId
Get restaurant by user ID (public)

#### GET /api/restaurants/:id
Get restaurant by ID (public)

#### POST /api/restaurants
Create new restaurant (authenticated)
```json
{
  "name": "Restaurant Name",
  "description": "Restaurant description",
  "address": "Restaurant address",
  "city": "City",
  "state": "State",
  "postal_code": "12345-678",
  "phone": "(11) 99999-9999",
  "email": "restaurant@example.com",
  "website": "https://restaurant.com",
  "max_capacity": 100
}
```

#### PUT /api/restaurants/:id
Update restaurant (authenticated, restaurant owner only)

#### DELETE /api/restaurants/:id
Delete restaurant (authenticated, restaurant owner only)

### Reservations

#### GET /api/reservations
Get reservations for current restaurant with pagination and filters
- Query params: `page`, `limit`, `date`, `status`, `area_id`, `table_id`

#### GET /api/reservations/today
Get today's reservations for current restaurant

#### GET /api/reservations/upcoming
Get upcoming reservations for current restaurant
- Query params: `days` (default: 7)

#### GET /api/reservations/:id
Get reservation by ID

#### POST /api/reservations
Create new reservation (authenticated, restaurant access required)
```json
{
  "customer_name": "Customer Name",
  "phone": "(11) 99999-9999",
  "number_of_people": 4,
  "reservation_date": "2025-01-15",
  "start_time": "19:00",
  "table_id": "uuid",
  "area_id": "uuid",
  "status": "pending",
  "notes": "Special requests"
}
```

#### PUT /api/reservations/:id
Update reservation

#### DELETE /api/reservations/:id
Delete reservation

#### PATCH /api/reservations/:id/status
Update reservation status
```json
{
  "status": "confirmed"
}
```

### Areas

#### GET /api/areas
Get areas for current restaurant (authenticated)

#### POST /api/areas
Create new area (authenticated, restaurant access required)
```json
{
  "name": "Area Name",
  "description": "Area description",
  "max_capacity": 50,
  "max_tables": 10
}
```

#### PUT /api/areas/:id
Update area

#### DELETE /api/areas/:id
Delete area

### Tables

#### GET /api/tables
Get tables for current restaurant (authenticated)

#### POST /api/tables
Create new table (authenticated, restaurant access required)
```json
{
  "area_id": "uuid",
  "number": 1,
  "name": "Table 1",
  "capacity": 4,
  "shape": "round",
  "width": 100,
  "height": 100,
  "position_x": 0,
  "position_y": 0
}
```

#### PUT /api/tables/:id
Update table

#### DELETE /api/tables/:id
Delete table

#### PATCH /api/tables/:id/status
Update table status
```json
{
  "status": "occupied"
}
```

### Menu

#### GET /api/menu/categories
Get menu categories for current restaurant

#### POST /api/menu/categories
Create menu category
```json
{
  "name": "Category Name",
  "description": "Category description"
}
```

#### PUT /api/menu/categories/:id
Update menu category

#### DELETE /api/menu/categories/:id
Delete menu category

#### GET /api/menu/items
Get menu items for current restaurant

#### POST /api/menu/items
Create menu item
```json
{
  "category_id": "uuid",
  "name": "Item Name",
  "description": "Item description",
  "price": 25.90
}
```

#### PUT /api/menu/items/:id
Update menu item

#### DELETE /api/menu/items/:id
Delete menu item

### Waiting Lists

#### GET /api/waiting-lists
Get waiting list entries for current restaurant
- Query params: `status` (optional)

### Customers

#### GET /api/customers
Get all customers for current restaurant with pagination and filters
- Query params: `page`, `limit`, `search`, `status`, `customer_type`
- Authentication required

#### GET /api/customers/stats
Get customer statistics for current restaurant
- Authentication required

#### GET /api/customers/:id
Get customer by ID
- Authentication required

#### POST /api/customers
Create new customer
- Authentication required
```json
{
  "name": "Customer Name",
  "phone_number": "(11) 99999-9999",
  "profile_image_url": "https://example.com/image.jpg",
  "status": "new",
  "customer_type": "new",
  "tags": ["vip", "returning"],
  "notes": "Special customer notes",
  "ai_enable": true
}
```

#### PUT /api/customers/:id
Update customer
- Authentication required

#### DELETE /api/customers/:id
Delete customer
- Authentication required

#### PATCH /api/customers/:id/status
Update customer status
- Authentication required
```json
{
  "status": "active"
}
```

### Experience Events

#### GET /api/experience/events
Get experience events for current restaurant
Returns:
```json
{
  "bonifications": [...],
  "events": [...],
  "events_exclusive": [...]
}
```

## Response Format

All API responses follow this format:

### Success Response
```json
{
  "success": true,
  "data": {...},
  "message": "Optional message"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message"
}
```

### Paginated Response
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

## Error Codes

- `400` - Bad Request (validation errors)
- `401` - Unauthorized (missing or invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (e.g., table already reserved)
- `500` - Internal Server Error

## Rate Limiting

- 100 requests per 15 minutes per IP address
- Exceeds limit returns 429 status code

## CORS

Development origins:
- `http://localhost:3000`
- `http://localhost:5173`
- `http://localhost:5174`
- `http://localhost:5175`

Production origins:
- `https://cheffguio.com`
- `https://www.cheffguio.com` 