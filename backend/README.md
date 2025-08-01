# Project Reliance Backend API

## Overview
Backend API for Project Reliance - A comprehensive service marketplace platform connecting vendors and clients.

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- Redis (v6 or higher)

### Installation

1. **Clone and navigate to backend directory**
```bash
cd backend
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp env.example .env
# Edit .env with your configuration
```

4. **Set up database**
```bash
# Create PostgreSQL database
createdb reliance_db

# Run migrations (coming soon)
npm run migrate
```

5. **Start development server**
```bash
npm run dev
```

The API will be available at `http://localhost:5000`

## 📁 Project Structure

```
backend/
├── src/
│   ├── config/          # Configuration files
│   ├── controllers/     # Route controllers
│   ├── middleware/      # Custom middleware
│   ├── models/          # Database models
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   ├── utils/           # Utility functions
│   └── app.ts          # Main application file
├── logs/               # Log files
├── uploads/            # File uploads
├── package.json
├── tsconfig.json
└── nodemon.json
```

## 🔧 Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm test` - Run tests (coming soon)

## 📊 API Endpoints

### Health Check
- `GET /health` - Server health status

### Authentication (Coming Soon)
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Refresh token

### Users (Coming Soon)
- `GET /api/users/profile` - Get user profile
- `PATCH /api/users/profile` - Update user profile

### Vendors (Coming Soon)
- `POST /api/vendors` - Create vendor
- `GET /api/vendors` - Get vendors
- `GET /api/vendors/:id` - Get vendor by ID

### Services (Coming Soon)
- `POST /api/services` - Create service
- `GET /api/services` - Get services
- `GET /api/services/:id` - Get service by ID

### Bookings (Coming Soon)
- `POST /api/bookings` - Create booking
- `GET /api/bookings` - Get bookings
- `GET /api/bookings/:id` - Get booking by ID

## 🛠️ Technology Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL
- **Cache**: Redis
- **Authentication**: JWT + bcrypt
- **Logging**: Winston
- **Validation**: Joi (coming soon)
- **Testing**: Jest (coming soon)

## 🔒 Security Features

- Helmet.js for security headers
- CORS configuration
- Input validation (coming soon)
- Rate limiting (coming soon)
- JWT authentication (coming soon)

## 📈 Development Roadmap

### Phase 1: Foundation ✅
- [x] Project setup
- [x] Basic Express server
- [x] Database connection
- [x] Logging system

### Phase 2: Authentication (Next)
- [ ] User registration/login
- [ ] JWT token management
- [ ] Password reset
- [ ] Email verification

### Phase 3: Core Models
- [ ] User management
- [ ] Vendor management
- [ ] Service management

### Phase 4: Booking System
- [ ] Booking creation
- [ ] Availability management
- [ ] Calendar integration

### Phase 5: Advanced Features
- [ ] Payment processing
- [ ] Review system
- [ ] Messaging system
- [ ] File uploads

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the ISC License.

## 🆘 Support

For support, email support@projectreliance.com or create an issue in the repository. 