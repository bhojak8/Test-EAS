# Emergency Alert System - Production Ready

A comprehensive emergency response and team coordination system built with React, TypeScript, and modern web technologies.

## 🚨 Features

- **Real-time Emergency Alerts**: Send and receive emergency notifications instantly
- **Live Location Tracking**: High-accuracy GPS tracking with geofencing capabilities
- **Team Coordination**: Multi-user sessions with role-based access control
- **Geofencing**: Create safe zones, restricted areas, and alert zones
- **Interactive Maps**: Free OpenStreetMap integration with advanced mapping features
- **Offline Support**: Works offline with local storage fallback
- **Mobile Responsive**: Optimized for mobile devices and tablets

## 🏗️ Architecture

### Frontend
- **React 19** with TypeScript for type safety
- **Tailwind CSS** for responsive styling
- **Leaflet** for mapping and geofencing
- **Sonner** for toast notifications
- **Local Storage** for offline data persistence

### Key Components
- `EmergencyDashboard`: Main dashboard for emergency management
- `FreeLeafletMap`: Advanced mapping with geofencing
- `AlertSystem`: Real-time alert management
- `SessionManagement`: Multi-user session handling
- `GeofenceManager`: Geofence creation and monitoring

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Modern web browser with geolocation support

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd emergency-alert-app

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your configuration

# Start development server
npm run dev
```

### Environment Variables

```bash
# Optional: Mapbox token for enhanced mapping (free tier available)
VITE_MAPBOX_ACCESS_TOKEN=your_mapbox_token_here

# Application Configuration
VITE_APP_NAME="Emergency Alert System"
VITE_APP_VERSION="1.0.0"
VITE_LOG_LEVEL="info"
VITE_ENABLE_ANALYTICS="false"
```

## 📱 Usage

### Creating an Emergency Session

1. **Sign In**: Use email/password or anonymous sign-in
2. **Create Session**: Click "Create Session" and provide a name
3. **Share Access**: Share the generated code or QR code with team members
4. **Start Tracking**: Enable location tracking for geofencing features

### Emergency Alerts

1. **Send Alert**: Click the red emergency button
2. **Select Type**: Choose from predefined alert types
3. **Add Message**: Provide additional context (optional)
4. **Acknowledge**: Team members can acknowledge alerts

### Geofencing

1. **Switch to Geofencing Tab**: Navigate to the geofencing section
2. **Draw Zones**: Use drawing tools to create safe/restricted/alert zones
3. **Configure Alerts**: Set entry/exit notifications
4. **Monitor**: System automatically detects zone violations

## 🔧 Configuration

### Alert Types
Customize alert types in the session settings:
- Emergency situations
- Medical emergencies
- Fire hazards
- Security threats
- Status updates

### Geofence Types
- **Safe Zones**: Areas where team members are secure
- **Restricted Zones**: No-entry areas with immediate alerts
- **Alert Zones**: Areas requiring caution

## 🛡️ Security Features

- **Input Validation**: All user inputs are validated and sanitized
- **XSS Protection**: Content Security Policy and input sanitization
- **Data Encryption**: Sensitive data is encrypted in storage
- **Rate Limiting**: API calls are rate-limited to prevent abuse
- **Secure Headers**: Security headers implemented for production

## 📊 Performance

- **Lazy Loading**: Components are lazy-loaded for better performance
- **Caching**: Intelligent caching of map tiles and user data
- **Debouncing**: Location updates are debounced to reduce API calls
- **Memory Management**: Proper cleanup of event listeners and timers

## 🧪 Testing

```bash
# Run unit tests
npm run test

# Run integration tests
npm run test:integration

# Run e2e tests
npm run test:e2e

# Generate coverage report
npm run test:coverage
```

## 📦 Deployment

### Production Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

### Docker Deployment

```bash
# Build Docker image
docker build -t emergency-alert-app .

# Run container
docker run -p 3000:3000 emergency-alert-app
```

### Environment-Specific Deployments

- **Development**: `npm run dev`
- **Staging**: `npm run build:staging`
- **Production**: `npm run build:production`

## 🔍 Monitoring

### Health Checks
- Application health endpoint: `/health`
- Database connectivity check
- External service availability

### Logging
- Structured JSON logging
- Error tracking and reporting
- Performance metrics collection

### Analytics
- User interaction tracking (privacy-compliant)
- Performance monitoring
- Error rate monitoring

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Standards
- Follow TypeScript strict mode
- Use ESLint and Prettier for code formatting
- Write unit tests for new features
- Update documentation for API changes

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [Wiki](link-to-wiki)
- **Issues**: [GitHub Issues](link-to-issues)
- **Discussions**: [GitHub Discussions](link-to-discussions)
- **Email**: support@emergency-alert-app.com

## 🗺️ Roadmap

### Version 1.1
- [ ] Push notifications
- [ ] Offline message queue
- [ ] Advanced analytics dashboard
- [ ] Multi-language support

### Version 1.2
- [ ] Voice alerts
- [ ] Video calling integration
- [ ] Advanced reporting
- [ ] API for third-party integrations

## 🙏 Acknowledgments

- OpenStreetMap for free mapping data
- Leaflet for mapping library
- React team for the excellent framework
- All contributors and testers

---

**Emergency Alert System** - Keeping teams safe and connected during critical situations.