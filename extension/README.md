# Table Screenshot Extension

A powerful Chrome extension that captures screenshots of tables and extracts structured data using OCR technology. Built with modern web technologies and Python backend for accurate table parsing.

## 🚀 Features

- **Full Page Screenshot**: Capture entire web pages with automatic scrolling
- **Smart Table Parsing**: Advanced OCR with intelligent column detection
- **Multiple Export Formats**: Generate JSON and Excel files
- **Real-time Processing**: Instant data extraction and formatting
- **Chrome Extension**: Seamless integration with browser workflow

## 📋 Requirements

- **Chrome Browser**: Latest version with Manifest V3 support
- **Python 3.9+**: For backend processing
- **Node.js 16+**: For extension development
- **Tesseract OCR**: For text recognition
- **Git**: For version control

## 🛠️ Quick Start

### Prerequisites
```bash
# Install Python dependencies
python3 -m pip install --upgrade pip

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Tesseract OCR
# macOS
brew install tesseract

# Ubuntu/Debian
sudo apt-get update && sudo apt-get install -y tesseract-ocr
```

### Installation & Setup
```bash
# Full development setup
make dev-setup

# Or manual setup:
make backend    # Install and run Python backend
make extension  # Build Chrome extension
make demo       # Run demo application
```

## 📁 Project Structure

```
├── backend/          # Python Flask backend
│   ├── app.py               # Main application
│   ├── requirements.txt     # Python dependencies
│   ├── screenshots/         # Temporary screenshots
│   └── exports/             # Generated JSON/Excel files
├── extension/               # Chrome extension
│   ├── src/                 # TypeScript source
│   ├── build/               # Built extension
│   └── package.json         # Node.js dependencies
├── demo/                    # React demo application
│   ├── src/                 # React components
│   └── package.json         # Node.js dependencies
├── Makefile                 # Project management
└── README.md               # This file
```

## 🎯 Usage

### 1. Start the Backend
```bash
make backend
```
The backend will start on `http://localhost:3001`

### 2. Build the Extension
```bash
make extension
```
The extension will be built in `extension/build/`

### 3. Load Extension in Chrome
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `extension/build` directory

### 4. Run the Demo
```bash
make demo
```
The demo will be available at `http://localhost:5173`

### 5. Capture Tables
1. Navigate to any webpage with tables
2. Click the extension icon
3. Click "Take Screenshot"
4. The extension will capture, process, and extract table data
5. Check `backend/exports/` for generated files

## 🔧 Available Commands

```bash
make help          # Show all available commands
make backend       # Install deps and run backend
make extension     # Build Chrome extension
make demo          # Run demo application
make clean         # Clean all generated files
make dev-setup     # Full development environment setup
make build         # Production build
```

## 📊 How It Works

1. **Screenshot Capture**: Extension captures full page screenshot
2. **OCR Processing**: Python backend uses Tesseract for text extraction
3. **Smart Parsing**: Advanced algorithms identify table structure and columns
4. **Data Formatting**: Extracted data is formatted into structured JSON
5. **Export Generation**: Creates both JSON and Excel files with parsed data

## 🎨 Technology Stack

### Frontend
- **Chrome Extension**: Manifest V3 with TypeScript
- **React**: Modern UI components
- **Vite**: Fast build tooling
- **React Query**: State management

### Backend
- **Python**: Flask web framework
- **Tesseract**: OCR text recognition
- **Pandas**: Data manipulation
- **OpenCV**: Image processing
- **Pillow**: Image handling

### Data Processing
- **Regex Pattern Matching**: Intelligent column detection
- **Date Recognition**: MM/DD/YYYY format parsing
- **Email Validation**: Email pattern matching
- **Numeric Detection**: Salary and ID number parsing

## 🔍 Supported Table Formats

The extension can handle various table structures:
- **ID Columns**: Numeric patterns (e.g., "123456789-0")
- **Email Columns**: Email addresses with validation
- **Date Columns**: MM/DD/YYYY format dates
- **Gender Columns**: Male/Female identification
- **Salary Columns**: Numeric salary data
- **Department Columns**: Text-based department names

## 🐛 Troubleshooting

### Common Issues

**Extension Not Loading**
- Ensure Manifest V3 compatibility
- Check Chrome developer console for errors
- Verify build directory structure

**OCR Not Working**
- Confirm Tesseract installation: `tesseract --version`
- Check backend logs for OCR errors
- Verify image quality and resolution

**Backend Connection Issues**
- Ensure backend is running on port 3001
- Check CORS configuration
- Verify firewall settings

**Parsing Errors**
- Check backend console for parsing logs
- Verify table structure in screenshot
- Review OCR output in backend logs

### Debug Mode

Enable detailed logging:
```bash
# Backend logs are automatically displayed when running
make backend

# Extension logs
# Open Chrome developer console
# Go to Extensions tab
# Click "service worker" for background script logs
# Click popup for extension logs
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 👨‍💼 Author

**Mohammed Hrima**
- Full-stack developer
- Chrome extension specialist
- OCR and image processing enthusiast

## 🙏 Acknowledgments

- **Tesseract OCR** - For powerful text recognition
- **React** - For modern UI development
- **Flask** - For lightweight Python backend
- **Chrome Extensions API** - For browser integration

---
