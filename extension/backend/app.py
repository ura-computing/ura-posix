import os
import json
import pandas as pd
import re
from PIL import Image
import pytesseract
from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = "screenshots"
EXPORT_FOLDER = "exports"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(EXPORT_FOLDER, exist_ok=True)

def extract_text_from_image(image_path):
    """Extract text using pytesseract with basic preprocessing"""
    try:
        # Open image
        img = Image.open(image_path)

        # Convert to grayscale
        if img.mode != 'L':
            img = img.convert('L')

        # Configure pytesseract for table recognition
        custom_config = r'--oem 3 --psm 6 -c preserve_interword_spaces=1'

        # Extract text
        text = pytesseract.image_to_string(img, config=custom_config)

        print(f"[INFO] Raw OCR text:\n{text}")
        return text

    except Exception as e:
        print(f"[ERROR] OCR failed: {str(e)}")
        # Fallback with basic config
        img = Image.open(image_path)
        text = pytesseract.image_to_string(img)
        return text

def parse_table_smart(text):
    """Parse table with specific pattern recognition"""
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    
    if len(lines) < 2:
        return [], []
    
    print(f"[INFO] Processing {len(lines)} lines")
    print(f"[INFO] Raw OCR text:\n{text}")
    
    # Skip UI info text
    info_keywords = ['dynamic', 'table', 'showing', 'rows', 'columns', 'data']
    data_lines = [line for line in lines if not any(keyword in line.lower() for keyword in info_keywords)]
    
    # Look for data rows with email pattern
    email_regex = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
    parsed_data = []
    
    for line in data_lines:
        print(f"[DEBUG] Processing line: '{line}'")
        
        # Skip if line is too short or doesn't contain email
        if len(line) < 10 or not re.search(email_regex, line):
            continue
            
        # Find email in the line
        email_match = re.search(email_regex, line)
        if not email_match:
            continue
            
        email = email_match.group()
        email_pos = email_match.start()
        
        # Extract parts before and after email
        before_email = line[:email_pos].strip()
        after_email = line[email_pos + len(email):].strip()
        
        # Parse the before email part (should contain Name and ID)
        # Pattern: ID Name or Name ID
        before_parts = re.split(r'\s{2,}', before_email)
        if len(before_parts) >= 2:
            # Try to identify which part is ID (numeric pattern)
            id_part = ""
            name_part = ""
            
            for part in before_parts:
                if re.match(r'^\d{9}-\d$', part.strip()):
                    id_part = part.strip()
                elif len(part.strip()) > 2:
                    if name_part:
                        name_part += " " + part.strip()
                    else:
                        name_part = part.strip()
        else:
            # Try single space split
            parts = before_email.split()
            if len(parts) >= 2:
                # Look for ID pattern
                for part in parts:
                    if re.match(r'^\d{9}-\d$', part):
                        id_part = part
                        break
                # Name is everything else
                name_part = " ".join([p for p in parts if p != id_part])
        
        # Parse the after email part (should contain Gender, City, Date)
        # Split by multiple spaces
        after_parts = re.split(r'\s{2,}', after_email)
        
        # Clean up the parts
        cleaned_parts = [part.strip() for part in after_parts if part.strip()]
        
        # Try to identify which part is date (MM/DD/YYYY pattern)
        date_regex = r'\d{1,2}/\d{1,2}/\d{4}'
        date_part = ""
        department_part = ""
        gender_part = ""
        salary_part = ""
        
        for part in cleaned_parts:
            if re.match(date_regex, part):
                date_part = part
            elif part.lower() in ['male', 'female']:
                gender_part = part
            elif re.match(r'^\d+$', part):
                # Numeric part is likely salary
                salary_part = part
            elif len(part) > 2 and not re.match(date_regex, part):
                # Text part is likely department
                department_part = part
        
        # Construct row with proper order: Name, Email, Gender, ID, Joining Date, Department, Salary
        row = [name_part, email, gender_part, id_part, date_part, department_part, salary_part]
        parsed_data.append(row)
        print(f"[DEBUG] Parsed row: {row}")
    
    # Define expected headers
    headers = ['Name', 'Email', 'Gender', 'ID', 'Joining Date', 'Department', 'Salary']
    
    # Clean and standardize rows
    cleaned_rows = []
    for row in parsed_data:
        cleaned_row = [field.strip() for field in row if field.strip()]
        
        # Pad or truncate to match header count
        if len(cleaned_row) < len(headers):
            cleaned_row.extend([""] * (len(headers) - len(cleaned_row)))
        elif len(cleaned_row) > len(headers):
            cleaned_row = cleaned_row[:len(headers)]
        
        cleaned_rows.append(cleaned_row)
    
    print(f"[INFO] Final cleaned rows: {cleaned_rows}")
    
    # Create JSON data with proper mapping
    json_data = []
    for row in cleaned_rows:
        row_obj = {}
        
        # Map the columns correctly
        row_obj['Name'] = row[0] if len(row) > 0 else ""
        row_obj['Email'] = row[1] if len(row) > 1 else ""
        row_obj['Gender'] = row[2] if len(row) > 2 else ""
        row_obj['ID'] = row[3] if len(row) > 3 else ""
        row_obj['Joining Date'] = row[4] if len(row) > 4 else ""
        row_obj['Department'] = row[5] if len(row) > 5 else ""
        row_obj['Salary'] = row[6] if len(row) > 6 else ""
        
        json_data.append(row_obj)
    
    print(f"[INFO] Final JSON: {json_data}")
    return [headers] + cleaned_rows, json_data

def save_to_excel(rows, filename):
    """Save data to Excel file"""
    try:
        if len(rows) < 2:
            raise ValueError("No data to save")
        
        headers = rows[0]
        data_rows = rows[1:]
        
        df = pd.DataFrame(data_rows, columns=headers)
        filepath = os.path.join(EXPORT_FOLDER, filename)
        df.to_excel(filepath, index=False, engine='openpyxl')
        return filepath
    except Exception as e:
        print(f"[ERROR] Excel save failed: {str(e)}")
        raise e

def save_to_json(json_data, filename):
    """Save data to JSON file"""
    try:
        filepath = os.path.join(EXPORT_FOLDER, filename)
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(json_data, f, indent=2, ensure_ascii=False)
        return filepath
    except Exception as e:
        print(f"[ERROR] JSON save failed: {str(e)}")
        raise e

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok"})

@app.route('/api/process-screenshot', methods=['POST'])
def process_screenshot():
    try:
        if 'screenshot' not in request.files:
            return jsonify({"error": "No screenshot provided"}), 400
        
        file = request.files['screenshot']
        if file.filename == '':
            return jsonify({"error": "No file selected"}), 400
        
        # Generate timestamp for filenames
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        screenshot_filename = f"screenshot_{timestamp}.png"
        screenshot_path = os.path.join(UPLOAD_FOLDER, screenshot_filename)
        
        # Save screenshot
        file.save(screenshot_path)
        print(f"[INFO] Saved: {screenshot_filename}")
        
        # Extract text from image
        text = extract_text_from_image(screenshot_path)
        print(f"[INFO] Extracted text length: {len(text)}")
        
        # Parse table data
        rows, json_data = parse_table_smart(text)
        
        if not rows:
            return jsonify({"error": "No table data found in screenshot"}), 422
        
        # Generate output filenames
        base_filename = f"table_{timestamp}"
        excel_filename = f"{base_filename}.xlsx"
        json_filename = f"{base_filename}.json"
        
        # Save to Excel and JSON
        excel_path = save_to_excel(rows, excel_filename)
        json_path = save_to_json(json_data, json_filename)
        
        print(f"[INFO] Saved: {excel_filename} + {json_filename}")
        
        # Return success response
        return jsonify({
            "success": True,
            "screenshot": screenshot_filename,
            "excel": excel_filename,
            "json": json_filename,
            "rows_count": len(rows) - 1,  # Exclude header row
            "data": json_data
        })
        
    except Exception as e:
        print(f"[ERROR] Processing failed: {str(e)}")
        return jsonify({"error": f"Processing failed: {str(e)}"}), 500

if __name__ == '__main__':
    print("[INFO] Starting Python backend server...")
    print("[INFO] Simple version without OpenCV")
    print("[INFO] Make sure Tesseract is installed on your system")
    print("[INFO] Install with: brew install tesseract (macOS) or apt-get install tesseract-ocr (Ubuntu)")
    app.run(host='0.0.0.0', port=3001, debug=True)
