# FarmTally User Role Management System

A comprehensive agricultural supply chain management platform that manages eight distinct user roles with sophisticated approval workflows, passwordless authentication, and role-based access control.

## Features

- **Passwordless Authentication**: Magic Link, OTP, and Social Authentication
- **Role-Based Access Control**: Eight distinct user roles with tailored permissions
- **Approval Workflows**: App Admin approval for all user registrations
- **Business Relationships**: Farm Admin as central hub connecting with service providers
- **Supply Chain Management**: End-to-end visibility from inputs to commodity sales

## User Roles

1. **App Admin**: System administrator with approval authority
2. **Farm Admin**: Business owner managing farm operations and relationships
3. **Field Manager**: Field operations specialist working with Farm Admin
4. **Farmer**: Commodity supplier providing agricultural products
5. **Lorry Agency**: Transportation service provider
6. **Field Equipment Manager**: Equipment provider and manager
7. **Input Supplier**: Provider of agricultural inputs
8. **Dealer**: Business entity purchasing commodities

## Project Structure

```
src/
├── models/           # TypeScript interfaces and data models
├── services/         # Business logic and service interfaces
├── repositories/     # Data access layer interfaces
├── api/             # API controllers and endpoints
├── utils/           # Utility functions and helpers
└── index.ts         # Main application entry point
```

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- TypeScript
- PostgreSQL database
- Redis (for session management)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy environment configuration:
   ```bash
   cp .env.example .env
   ```

4. Update the `.env` file with your configuration values

5. Build the project:
   ```bash
   npm run build
   ```

6. Start the development server:
   ```bash
   npm run dev
   ```

### Scripts

- `npm run build` - Build the TypeScript project
- `npm run dev` - Start development server with hot reload
- `npm start` - Start production server
- `npm test` - Run tests
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues

## Configuration

The application uses environment variables for configuration. See `.env.example` for all available options.

### Key Configuration Areas

- **Database**: PostgreSQL connection settings
- **Authentication**: JWT secrets, magic link configuration
- **Email**: SMTP settings for sending emails
- **SMS**: SMS provider configuration for OTP
- **Google OAuth**: Social authentication setup

## Architecture

The system follows a layered architecture:

- **Models**: Define data structures and interfaces
- **Services**: Implement business logic
- **Repositories**: Handle data persistence
- **API**: Expose HTTP endpoints
- **Utils**: Provide common utilities

## Authentication Methods

### Magic Link Authentication
- Secure, time-limited email links
- Primary authentication method
- Used for login and invitations

### OTP Authentication
- SMS and email-based one-time passwords
- Fallback authentication method
- Configurable expiry and retry limits

### Social Authentication
- Google Sign-In integration
- Streamlined user experience
- Account linking capabilities

## Business Relationships

The system centers around Farm Admins who establish relationships with:

- **Field Managers**: Direct reporting relationship
- **Farmers**: Commodity supply relationships
- **Service Providers**: Various business relationships
  - Lorry Agencies (transportation)
  - Equipment Managers (machinery)
  - Input Suppliers (seeds, fertilizers)
  - Dealers (commodity purchasing)

## Development

### Adding New Features

1. Define interfaces in the appropriate model files
2. Implement service interfaces for business logic
3. Create repository interfaces for data access
4. Add API controllers for HTTP endpoints
5. Write tests for new functionality

### Testing

The project uses Jest for testing. Tests should focus on:

- Core business logic validation
- Authentication and authorization
- Data model integrity
- API endpoint functionality

## License

MIT License - see LICENSE file for details