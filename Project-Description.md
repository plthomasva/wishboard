# Project description

This is a project to have a disconnected, private wish board at a convention, running on a Raspberry Pi 4 or similar device. There may also be a private, non-Internet connected wireless network where tablets in "kiosk mode" can enter wishes or search for wishes.

A rotating display of active wishes, arranged visually similarly to the physical analog of pinned up 3x5 cards should also be displayed on one or more connected monitors.

We also want a remote development preview mode that shows the kiosk and main display together in a browser, so distributed team members can try the system live.

We need three basic views:
1. Enter a wish
2. search for wishes
3. Display random, rotating wishes on the big screens

Implied are a home screen on the tablets where users can select one of the views. We also need an admin interface to:
1. manage admin users (super admin(s) only)
2. review flagged wishes and remove any that violate the law or convention policies.
3. manage self-service unprivileged users
4. seed demo users and wishes for development and testing

Users should be given a simple wish ID and easy to write down or remember security token or code word, so that they can come back and update or remove their own wishes. We may want to have a simple, self-service way for users to create an account in the system to manage multiple wishes. Security should be by easy to remember pass phrases.

The system now supports richer user and wish metadata for compatibility matching:

- Users may self-identify with gender, orientation, and role.
- Wishes may include desired fulfiller gender(s), orientation(s), and role(s).
- Search filters wish results by compatibility with the searching user's identity attributes when available.
- Users can temporarily disable their own profile attributes to search more broadly.

# Constraints and assumptions

1. The system must run disconnected from the Internet, thus any images or artifacts must be present on the host device.
2. Make maximal use of open source packages which support these requirements, rather than writing new code
