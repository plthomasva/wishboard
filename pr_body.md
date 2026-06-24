This PR adds a major new feature: the ability to capture handwritten wishes via the device camera!

## Changes
- **Client-Side Scanner**: Integrated `tesseract.js` (OCR) and `opencv.js` into a new `WishScanner` React component to capture and process 3x5 cards.
- **On-Screen Sticker Overlay**: The viewfinder dynamically displays an overlaid "Sticker Zone" so users know exactly where to leave blank space for identity stickers.
- **Card Normalization**: OpenCV `findContours` and `getPerspectiveTransform` automatically frame and flatten the card.
- **Text Recognition**: The browser uses a local WebAssembly Tesseract model to convert the handwriting into searchable text.
- **Backend Uploads**: Upgraded `POST /api/wishes` to accept `multipart/form-data` uploads using `multer`, storing the processed images directly to `data/images`.
- **Dynamic Render**: `WishCard.tsx` now conditionally displays the physical card image (if present) and dynamically positions the actual digital identity pills in the bottom-right corner.

These heavy computer-vision tasks run entirely within the browser's sandbox to keep the Raspberry Pi responsive!
