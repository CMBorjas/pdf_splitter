# PDF Splitter Web Application

## Overview
This project is a blueprint for a web-based PDF splitting tool inspired by popular online PDF utilities. It allows users to upload a PDF document, visually preview its pages, and split or extract specific pages into separate PDF files.

## Core Features to Build
- **Visual Page Preview:** Generate and display grid thumbnails for every page in the uploaded PDF.
- **Interactive UI:** Clickable thumbnails with selection indicators (e.g., green checkmarks) to toggle pages in or out of the extraction.
- **Multiple Split Modes:**
  - **Extract all pages:** Converts every selected page into its own separate PDF document.
  - **Select pages/Ranges:** Allows users to define specific custom ranges (e.g., 1-5, 8, 10-12) to merge into a single new document or split.
- **Dynamic Summaries:** An information panel calculating the expected output (e.g., "18 PDF will be created").
- **Embeddable & Theming Ready:** Built as a modular component that utilizes CSS variables, allowing it to be easily integrated into any external website and instantly restyled to match the host's design system.

## Recommended Tech Stack

### Frontend Architecture
- **Framework:** React.js, Vue.js, or plain HTML/CSS/JS.
- **Styling:** CSS Grid or Flexbox for the thumbnail gallery layout.
- **PDF Rendering (Thumbnails):** [PDF.js](https://mozilla.github.io/pdf.js/) by Mozilla. This is the industry standard for reading an uploaded file and rendering each page onto an HTML5 `<canvas>` element for the visual preview.

### PDF Manipulation (The Engine)
- **Client-side Approach (Recommended for privacy and speed):** [pdf-lib](https://pdf-lib.js.org/). A powerful JavaScript library that allows you to read, create, and modify PDF documents directly in the browser without uploading files to a server.
- **Backend Approach (Optional, for heavy processing):** Node.js + `pdf-lib`, or Python using libraries like `PyPDF2` or `pikepdf`.

## Implementation Workflow

1. **File Upload:** Provide a file input or drag-and-drop zone. Retrieve the `File` object via Javascript.
2. **Generate Previews (PDF.js):**
   - Read the file as an `ArrayBuffer`.
   - Pass the buffer to `pdf.js` to load the document.
   - Loop from page 1 to `pdf.numPages`, fetch each page, and render it to a canvas to display the grid of thumbnails.
3. **State Management:**
   - Maintain an array of "selected" pages in your application state.
   - Toggle selection when a user clicks a thumbnail, updating the UI checkmarks.
4. **Processing the Split (pdf-lib):**
   - When the user clicks the prominent "Split PDF" button, load the original PDF buffer into `pdf-lib`.
   - Create new, empty `PDFDocument` instances for the output.
   - Use the `copyPages` method from `pdf-lib` to extract the selected pages from the original document and inject them into the new document(s).
5. **Handling the Download:**
   - Save the newly generated PDF(s) to a `Uint8Array`.
   - **Single File:** Trigger a direct download by creating a `Blob` URL.
   - **Multiple Files (Extract all):** Use a library like [JSZip](https://stuk.github.io/jszip/) to bundle the multiple PDFs into a single `.zip` file for user convenience.

## Getting Started (Development Boilerplate)

1. Initialize your project environment (e.g., using Vite, Create React App, or plain NPM).
2. Install the necessary dependencies: