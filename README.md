# maimaimai - Mobile Queue Manager for maimai Arcade

A mobile-first web application for managing player queues in maimai arcade rhythm game sessions. Built with vanilla JavaScript and designed specifically for touch devices used in arcade environments.

<p align="center">
  <a href="https://x01jin.github.io/maimaimai/">
    <img src="https://img.shields.io/badge/🚀%20Try%20it%20now!-blue?style=for-the-badge" alt="Try it now!" />
  </a>
  <br>
  <br>
  <img src="https://img.shields.io/badge/maimai-Queue%20Manager-orange" alt="maimai Queue Manager" style="margin:0 8px;" />
  <img src="https://img.shields.io/badge/Mobile-First-yellow" alt="Mobile" style="margin:0 8px;" />
  <img src="https://img.shields.io/badge/Vanilla%20JS-ES6-blue" alt="JavaScript" style="margin:0 8px;" />
  <img src="https://img.shields.io/badge/Bootstrap-5.3.0-purple" alt="Bootstrap" style="margin:0 8px;" />

## 🎮 Overview

**maimaimai** is a specialized queue management system designed for maimai arcade players and organizers. It provides an intuitive mobile interface for:

- Managing player queues for maimai matches
- Supporting both solo and versus (2-player) game modes
- Real-time queue status and match progression
- Drag-and-drop queue reordering
- Persistent storage across sessions

Perfect for arcade gatherings, tournaments, or casual play sessions where multiple players need to take turns on a single maimai cabinet.

## ✨ Features

### Core Functionality

- **Queue Management**: Add, remove, and reorder players in the queue
- **Match Types**: Support for both solo and versus matches
- **Real-time Updates**: Live queue status and current match display
- **Drag & Drop**: Intuitive reordering of queue positions
- **Persistent Storage**: Queue data saved locally across sessions

### User Interface

- **Mobile-First Design**: Optimized for touch devices and small screens
- **Bootstrap 5**: Modern, responsive UI components
- **Floating Action Buttons**: Easy access to key functions
- **Modal Dialogs**: Clean, accessible forms and help screens
- **Visual Status Indicators**: Clear display of match states and player turns

### User Experience

- **Intuitive Controls**: Simple, arcade-friendly interface
- **Form Validation**: Real-time input validation and feedback
- **Help System**: Built-in usage instructions and guides
- **Responsive Design**: Works on various mobile devices and screen sizes

## 🚀 Quick Start

### Prerequisites

- Modern web browser (Chrome, Firefox, Safari, Edge)
- Touch-enabled device (recommended for best experience)
- Local web server (for development/testing)

## 📱 Usage

### Basic Workflow

1. **Add Players**: Click the blue "+" button to add players to the queue

   - Enter Player 1 name (required)
   - Optionally enter Player 2 name for versus matches
   - Solo matches are automatically detected when only one player is entered

2. **Start Playing**: The first match automatically becomes the "Current Match"

   - Click the green play button next to a queued match to start it
   - Or wait for the current match to complete

3. **Complete Matches**: Click "Complete" when a match finishes

   - The next player in queue automatically becomes current
   - Completed matches are removed from the active queue

4. **Manage Queue**: Use the grip handles to drag and drop matches for reordering

### Interface Guide

- **Current Match Card**: Shows the player(s) currently playing
- **Queue List**: Displays all waiting players in order
- **FAB Buttons**:
  - Blue "+" : Add new match to queue
  - Blue "?" : Show help and usage instructions
  - Gray "♥" : Credits and information (placeholder)

## 🏗️ Architecture

### Module Overview

#### QueueManager (`modules/queue-manager.js`)

- **Purpose**: Core business logic for queue operations
- **Features**:
  - Match validation and state management
  - Queue manipulation (add, remove, reorder)
  - Event system for UI updates
  - Match progression and completion

#### QueueStorage (`modules/queue-storage.js`)

- **Purpose**: Persistent data management
- **Features**:
  - Local storage abstraction
  - Data serialization/deserialization
  - Queue persistence across sessions

#### UIDisplay (`modules/ui-display.js`)

- **Purpose**: User interface rendering and interaction
- **Features**:
  - Dynamic UI updates
  - Modal management
  - Drag-and-drop functionality
  - Event handling for user interactions

### Technology Stack

- **Frontend**: Vanilla JavaScript (ES6+)
- **Styling**: Bootstrap 5.3.0 + Custom CSS
- **Icons**: Font Awesome 6.4.0
- **Storage**: Browser Local Storage API
- **Architecture**: Modular ES6 modules

### Code Organization

The application follows a modular architecture:

- **Entry Point**: `index.js` handles initialization and global events
- **Business Logic**: `queue-manager.js` contains core queue operations
- **Data Layer**: `queue-storage.js` manages persistence
- **Presentation Layer**: `ui-display.js` handles UI rendering

### Adding Features

1. **UI Changes**: Modify `modules/ui-display.js` for interface updates
2. **Business Logic**: Update `modules/queue-manager.js` for new functionality
3. **Persistence**: Modify `modules/queue-storage.js` for data changes
4. **Integration**: Update `index.js` for new event handling

## 🎯 Use Cases

### Arcade Sessions

Perfect for maimai arcade gatherings where multiple players share a single cabinet. Players can line up and wait their turn in an organized manner.

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Development Guidelines

- Follow the existing code style and modular architecture
- Test on mobile devices for optimal user experience
- Update documentation for new features
- Ensure backward compatibility with existing queue data

## 📄 License

This project is open source. Please check the LICENSE file for specific terms.

## 📞 Support

For questions, suggestions, or issues:

1. **Check existing issues** on GitHub
2. **Create a new issue** with detailed description
3. **Feature requests** are always welcome

---

Built with ❤️ for the maimai community!
