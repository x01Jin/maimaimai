# Double-Tap to Leave

## Overview

To prevent accidental leaves and improve user experience on mobile devices, the "Leave" and "Leave Queue" actions now require a double-tap interaction. This prevents users from unintentionally exiting a session or queue due to accidental touches.

## Logic Implementation

The double-tap logic is centralized in the `useDoubleTap` hook. This hook manages the "Armed" state of the interaction.

- **Hook:** `hooks/useDoubleTap.ts`
- **Delay:** 2000ms (window of time to perform the second tap)

### State Transitions

1. **Idle State:** The button displays its default text and style.
2. **Armed State:** Triggered on the first tap.
   - The button text changes (e.g., from "Leave" to "SURE?").
   - Visual feedback is applied (glow, scale up, or pulsing icons).
   - If no second tap occurs within 2 seconds, the button reverts to the Idle state.
3. **Action Execution:** Triggered on the second tap while in the Armed state.
   - The primary action (e.g., leaving the session or queue) is executed.

## Applied Components

### 1. Main Navigation Leave Button (`App.tsx`)

- Located in the bottom sticky navigation bar.
- On the first tap, the label changes to "Sure?" and the icon pulses.
- On the second tap, it opens the "Leave Session" confirmation modal. (Double confirmation ensures maximum safety for session exit).

### 2. Queue Item Leave Button (`views/QueueView.tsx`)

- Located within each individual queue entry.
- On the first tap, the button scales up and glows red with the text "SURE?".
- On the second tap, it immediately removes the player from the queue.

### 3. Mod Solo Decision Buttons (`views/ChatView.tsx`)

- Located in the active vote overlay within the chat.
- Mods have "APPROVE" and "REJECT" buttons.
- On the first tap, the button text changes to "SURE?".
- On the second tap, it opens a Confirmation Modal for final confirmation.

## UX Benefits

- **Intentionality:** Reduces friction for intentional leaves while providing a hard barrier for accidental ones.
- **Visual Feedback:** Clear, animated transitions let the user know their first tap was registered and that a second tap is required for a destructive action.
- **Safe Fingers:** Especially useful in arcade environments where users might be handling phones quickly between sets.
