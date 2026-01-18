# In-App Help & Info feature

## Overview

The Help & Info feature provides users with immediate access to instructions and feature details directly within the application. It is implemented as a dedicated view accessible via the main navigation bar.

## Architecture

- **View Component:** `views/HelpView.tsx`
- **Integration:** Integrated into `App.tsx` as a conditional tab (`tab === 'help'`).
- **Navigation:** Added a new button to the bottom sticky navigation bar.

## Structure

The Help View features a split layout (responsive):

- **Right Sidebar (Desktop) / Drawer (Mobile):** Navigation menu to switch between help sections.
- **Main Content Area:** Displays the selected help topic.

### Sections

1. **General Help:** Overview of the application flow and queue modes (Duo, Partner, Solo).
2. **Queue System:** Explains the queue interface, "Up Next", "Currently Playing", and Mod controls.
3. **Players:** Explains the player list, online status indicators, and role identification.
4. **Chat Features:** details mentions, replies, and reactions.
5. **About:** Credits the creator (x01Jin) and contributors, and links to the GitHub repository.

## Implementation Details

- **Responsive Design:** The sidebar collapses into a hamburger menu on mobile devices to maximize content space.
- **Icons:** Uses `lucide-react` icons for consistent visual language.
- **Animation:** Sections fade in for a polished user experience.

## Usage

To update the help content, modify the `renderContent` function in `views/HelpView.tsx`.
