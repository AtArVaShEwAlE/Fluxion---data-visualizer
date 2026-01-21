from flask import Flask, render_template, request, jsonify, redirect, url_for, flash
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
import pandas as pd
import os
from werkzeug.utils import secure_filename
from datetime import datetime
import traceback
import sys
from flask_socketio import SocketIO, emit, join_room, leave_room
import json
import random
import time
from threading import Thread

# Import our models and forms
from models import db, User, Dataset, Chart
from forms import LoginForm, SignupForm, ProfileForm, ChangePasswordForm

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-here'
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

app.config["SQLALCHEMY_DATABASE_URI"] = 'sqlite:///fluxion.db'
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db.init_app(app)
socketio = SocketIO(app,cors_allowed_origins="*")

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'
login_manager.login_message = 'Please log in to access this page.'
login_manager.login_message_category = 'info'

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# Create uploads directory if it doesn't exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Allowed file extensions
ALLOWED_EXTENSIONS = {'csv', 'xlsx', 'xls'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Routes
@app.route('/')
def landing():
    """Landing page"""
    return render_template('landing.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    
    form = LoginForm()
    if form.validate_on_submit():
        user = User.query.filter_by(username=form.username.data).first()
        if user and user.check_password(form.password.data):
            login_user(user, remember=form.remember_me.data)
            flash("Welcome back!", "success")
            next_page = request.args.get('next')
            return redirect(next_page) if next_page else redirect(url_for('dashboard'))
        else:
            flash('Invalid username or password', 'error')
    return render_template('auth/login.html', form=form)

@app.route('/signup', methods=['GET','POST'])
def signup():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    
    form = SignupForm()
    if form.validate_on_submit():
        user = User(
            username=form.username.data,
            email=form.email.data,
            full_name=form.full_name.data
        )
        user.set_password(form.password.data)
        db.session.add(user)
        db.session.commit()
        
        flash('Congratulations! Your account has been created.', 'success')
        return redirect(url_for('login'))
    
    return render_template('auth/signup.html', form=form)

@app.route('/logout')
@login_required
def logout():
    logout_user()
    flash('You have been logged out.', 'info')
    return redirect(url_for('landing'))

@app.route('/profile', methods=['GET', 'POST'])
@login_required
def profile():
    form = ProfileForm(current_user.email)
    if form.validate_on_submit():
        current_user.email = form.email.data
        current_user.full_name = form.full_name.data
        db.session.commit()
        flash('Your profile has been updated.', 'success')
        return redirect(url_for('profile'))
    elif request.method == 'GET':
        form.username.data = current_user.username
        form.email.data = current_user.email
        form.full_name.data = current_user.full_name
    
    days_since_joined = (datetime.utcnow() - current_user.created_at).days

    recent_activity = []
    if current_user.datasets:
        for dataset in current_user.datasets[-3:]:
            recent_activity.append({
                'icon': '📊',
                'text': f'Uploaded dataset "{dataset.original_filename}"',
                'time': dataset.upload_date.strftime('%B %d, %Y'),
            })
    
    return render_template('auth/profile.html',
                           form=form,
                           days_since_joined=days_since_joined,
                           recent_activity=recent_activity)

@app.route("/change-password", methods=['GET','POST'])
@login_required
def change_password():
    form = ChangePasswordForm()
    if form.validate_on_submit():
        if current_user.check_password(form.current_password.data):
            current_user.set_password(form.new_password.data)
            db.session.commit()
            flash('Your password has been changed successfully.', 'success')
            return redirect(url_for('profile'))
        else:
            flash('Current password is incorrect.', 'error')
    
    return render_template('auth/change_password.html', form=form)

@app.route('/dashboard')
@login_required
def dashboard():
    """Dashboard - file upload and data management"""
    recent_datasets = Dataset.query.filter_by(user_id=current_user.id)\
                                   .order_by(Dataset.upload_date.desc())\
                                   .limit(5)\
                                   .all()
    
    recent_activity = []
    for dataset in recent_datasets:
        recent_activity.append({
            'icon': '📊',
            'text': f'Uploaded "{dataset.original_filename}"',
            'time': dataset.upload_date.strftime('%B %d, %Y at %I:%M %p'),
            'id': dataset.id
        })
    
    return render_template('dashboard.html', recent_activity=recent_activity)

@app.route('/create-chart')
@login_required
def create_chart():
    """Chart creation interface"""
    return render_template('create_chart.html')

@app.route('/charts')
@login_required
def charts():
    user_charts = Chart.query.filter_by(user_id=current_user.id).order_by(Chart.created_at.desc()).all()
    return render_template('charts.html', charts=user_charts)

@app.route('/upload', methods=['POST'])
@login_required
def upload_file():
    try:
        print("=" * 50)
        print("UPLOAD REQUEST RECEIVED")
        print("=" * 50)
        
        if 'file' not in request.files:
            print("ERROR: No file in request")
            return jsonify({'error': 'No file selected'}), 400
        
        file = request.files['file']
        if file.filename == '':
            print("ERROR: Empty filename")
            return jsonify({'error': 'No file selected'}), 400
        
        print(f"File received: {file.filename}")
        
        if not file or not allowed_file(file.filename):
            print(f"ERROR: Invalid file type")
            return jsonify({'error': 'Invalid file type. Please upload CSV or Excel files.'}), 400
        
        filename = secure_filename(file.filename)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        unique_filename = f"{current_user.id}_{timestamp}_{filename}"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
        
        print(f"Saving file to: {filepath}")
        
        # Save the file
        file.save(filepath)
        print(f"File saved successfully. Size: {os.path.getsize(filepath)} bytes")
        
        # Read the file based on extension
        file_ext = filename.rsplit('.', 1)[1].lower()
        print(f"File extension: {file_ext}")
        
        try:
            if file_ext == 'csv':
                print("Reading as CSV...")
                # Try different encodings for CSV
                try:
                    df = pd.read_csv(filepath, encoding='utf-8')
                except UnicodeDecodeError:
                    try:
                        df = pd.read_csv(filepath, encoding='latin-1')
                    except UnicodeDecodeError:
                        df = pd.read_csv(filepath, encoding='iso-8859-1')
            elif file_ext in ['xlsx', 'xls']:
                print(f"Reading as Excel ({file_ext})...")
                # Read Excel file with specific parameters
                engine = 'openpyxl' if file_ext == 'xlsx' else None
                
                # Try reading with different sheet options
                try:
                    df = pd.read_excel(filepath, engine=engine, sheet_name=0)
                    print(f"Excel file read successfully")
                    print(f"Shape: {df.shape}")
                    print(f"Columns: {df.columns.tolist()}")
                except Exception as excel_error:
                    print(f"Error reading Excel with engine {engine}: {str(excel_error)}")
                    # Try without specifying engine
                    df = pd.read_excel(filepath, sheet_name=0)
            else:
                print(f"ERROR: Unsupported file format: {file_ext}")
                return jsonify({'error': 'Unsupported file format'}), 400
            
            print(f"DataFrame loaded. Shape: {df.shape}")
            print(f"Columns ({len(df.columns)}): {df.columns.tolist()}")
            print(f"First few rows:\n{df.head()}")
        
        except Exception as read_error:
            # Clean up the file if reading failed
            if os.path.exists(filepath):
                os.remove(filepath)
            print(f"ERROR reading file:")
            print(traceback.format_exc())
            return jsonify({'error': f'Error reading file: {str(read_error)}'}), 400
        
        # Check if dataframe is empty
        if df.empty:
            if os.path.exists(filepath):
                os.remove(filepath)
            print("ERROR: DataFrame is empty")
            return jsonify({'error': 'The uploaded file is empty'}), 400
        
        # Clean the data - replace NaN values with empty strings
        print("Cleaning data...")
        df_clean = df.fillna('')
        
        # Convert column names to strings and strip whitespace
        print("Processing column names...")
        df.columns = df.columns.astype(str).str.strip()
        df_clean.columns = df_clean.columns.astype(str).str.strip()
        
        # Remove any unnamed columns
        df = df.loc[:, ~df.columns.str.contains('^Unnamed')]
        df_clean = df_clean.loc[:, ~df_clean.columns.str.contains('^Unnamed')]
        
        print(f"Final columns: {df.columns.tolist()}")
        
        # Create dataset record in database
        print("Creating database record...")
        dataset = Dataset(
            filename=unique_filename,
            original_filename=filename,
            file_size=os.path.getsize(filepath),
            rows=len(df),
            columns=len(df.columns),
            user_id=current_user.id
        )
        
        # Convert data types to strings safely
        print("Setting column names and data types...")
        dataset.set_column_names(df.columns.tolist())
        
        # Convert dtypes to dict safely
        dtypes_dict = {}
        for col in df.columns:
            try:
                dtypes_dict[col] = str(df[col].dtype)
            except Exception as dtype_error:
                print(f"Warning: Could not get dtype for column {col}: {str(dtype_error)}")
                dtypes_dict[col] = 'object'
        
        dataset.set_data_types(dtypes_dict)
        
        # Get preview data (first 10 rows)
        print("Setting preview data...")
        preview_data = df_clean.head(10).to_dict('records')
        
        # Clean preview data - convert any problematic values
        cleaned_preview = []
        for row in preview_data:
            cleaned_row = {}
            for key, value in row.items():
                try:
                    # Convert to string if it's not a standard type
                    if pd.isna(value) or value == '':
                        cleaned_row[key] = ''
                    elif isinstance(value, (int, float, str, bool)):
                        cleaned_row[key] = value
                    else:
                        cleaned_row[key] = str(value)
                except Exception as val_error:
                    print(f"Warning: Could not process value for {key}: {str(val_error)}")
                    cleaned_row[key] = ''
            cleaned_preview.append(cleaned_row)
        
        dataset.set_preview_data(cleaned_preview)
        
        print("Saving to database...")
        db.session.add(dataset)
        db.session.commit()
        
        # Return the dataset info
        data_info = dataset.to_dict()
        
        print("SUCCESS! Dataset uploaded and saved")
        print(f"Dataset ID: {dataset.id}")
        print("=" * 50)
        
        return jsonify({
            'success': True,
            'data': data_info
        })
        
    except Exception as e:
        print("=" * 50)
        print("FATAL ERROR in upload_file:")
        print(str(e))
        print(traceback.format_exc())
        print("=" * 50)
        return jsonify({'error': f'Error processing file: {str(e)}'}), 500

@app.route('/save-chart', methods=['POST'])
@login_required
def save_chart():
    try:
        data = request.get_json()

        chart = Chart(
            title=data.get('title', 'Untitled Chart'),
            chart_type=data.get('chart_type', 'bar'),
            user_id=current_user.id,
            dataset_id=data.get('dataset_id')
        )

        chart.set_config({
            'x_axis': data.get('x_axis'),
            'y_axis': data.get('y_axis'),
            'value_column': data.get('value_column'),
            'label_column': data.get('label_column'),
            'color_scheme': data.get('color_scheme', 'default'),
            'chart_options': data.get('chart_options', {})
        })
        
        db.session.add(chart)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'chart_id': chart.id,
            'message': 'Chart saved successfully!'
        })
        
    except Exception as e:
        print(f"Error saving chart: {str(e)}")
        print(traceback.format_exc())
        return jsonify({'error': f'Error saving chart: {str(e)}'}), 500

@app.route('/delete-chart/<int:chart_id>', methods=['DELETE'])
@login_required
def delete_chart(chart_id):
    """Delete a chart"""
    try:
        chart = Chart.query.get_or_404(chart_id)
        
        if chart.user_id != current_user.id:
            return jsonify({'error': 'Unauthorized'}), 403
        
        db.session.delete(chart)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Chart deleted successfully!'
        })
        
    except Exception as e:
        print(f"Error deleting chart: {str(e)}")
        return jsonify({'error': f'Error deleting chart: {str(e)}'}), 500

@app.route('/get-chart/<int:chart_id>', methods=['GET'])
@login_required
def get_chart(chart_id):
    """Get chart data for viewing"""
    try:
        chart = Chart.query.get_or_404(chart_id)
        
        if chart.user_id != current_user.id:
            return jsonify({'error': 'Unauthorized'}), 403
        
        chart_data = chart.to_dict()
        
        return jsonify({
            'success': True,
            'chart': chart_data
        })
        
    except Exception as e:
        print(f"Error loading chart: {str(e)}")
        return jsonify({'error': f'Error loading chart: {str(e)}'}), 500

@app.route('/download-dataset/<int:dataset_id>')
@login_required
def download_dataset(dataset_id):
    """Download dataset as CSV"""
    try:
        dataset = Dataset.query.get_or_404(dataset_id)
        
        if dataset.user_id != current_user.id:
            return jsonify({'error': 'Unauthorized'}), 403
        
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], dataset.filename)
        
        if not os.path.exists(filepath):
            return jsonify({'error': 'File not found'}), 404
        
        from flask import send_file
        return send_file(
            filepath,
            as_attachment=True,
            download_name=dataset.original_filename,
            mimetype='application/octet-stream'
        )
        
    except Exception as e:
        print(f"Error downloading file: {str(e)}")
        return jsonify({'error': f'Error downloading file: {str(e)}'}), 500

@app.route('/export-chart-pdf/<int:chart_id>')
@login_required
def export_chart_pdf(chart_id):
    """Export chart as PDF"""
    try:
        chart = Chart.query.get_or_404(chart_id)
        
        if chart.user_id != current_user.id:
            return jsonify({'error': 'Unauthorized'}), 403
        
        return jsonify({
            'success': False,
            'message': 'PDF export will be implemented via client-side conversion'
        })
        
    except Exception as e:
        return jsonify({'error': f'Error exporting PDF: {str(e)}'}), 500

@app.route('/share-chart/<int:chart_id>', methods=['POST'])
@login_required
def share_chart(chart_id):
    """Generate shareable link for a chart"""
    try:
        chart = Chart.query.get_or_404(chart_id)
        
        if chart.user_id != current_user.id:
            return jsonify({'error': 'Unauthorized'}), 403
        
        if not chart.share_token:
            chart.generate_share_token()
        
        chart.is_public = True
        db.session.commit()
        
        share_url = request.host_url + 'shared/' + chart.share_token
        
        return jsonify({
            'success': True,
            'share_url': share_url,
            'share_token': chart.share_token
        })
        
    except Exception as e:
        return jsonify({'error': f'Error sharing chart: {str(e)}'}), 500

@app.route('/unshare-chart/<int:chart_id>', methods=['POST'])
@login_required
def unshare_chart(chart_id):
    """Make chart private (disable sharing)"""
    try:
        chart = Chart.query.get_or_404(chart_id)
        
        if chart.user_id != current_user.id:
            return jsonify({'error': 'Unauthorized'}), 403
        
        chart.is_public = False
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Chart is now private'
        })
        
    except Exception as e:
        return jsonify({'error': f'Error unsharing chart: {str(e)}'}), 500

@app.route('/shared/<share_token>')
def view_shared_chart(share_token):
    """View a publicly shared chart (no login required)"""
    try:
        chart = Chart.query.filter_by(share_token=share_token, is_public=True).first_or_404()
        
        return render_template('shared_chart.html', chart=chart.to_dict())
        
    except Exception as e:
        return render_template('error.html', 
                             error='Chart not found or no longer shared',
                             message='This chart may have been made private or deleted.')

@app.route('/live-data')
@login_required
def live_data():

    datasets = Dataset.query.filter_by(user_id=current_user.id)\
                           .order_by(Dataset.upload_date.desc())\
                           .all()
    return render_template("live_data.html",datasets=datasets)

@socketio.on('connect')
def handle_connect():
    print(f'client connected: {request.sid}')
    emit('connection_response',{'status':'connected'})

@socketio.on('disconnect')
def handle_disconnect():
    print(f'Client disconnected: {request.sid}')

@socketio.on('join_live_session')
def handle_join_session(data):
    session_id = data.get('session_id')
    join_room(session_id)
    emit('joined_session', {'session_id': session_id})

@socketio.on('leave_live_session')
def handle_leave_session(data):
    session_id = data.get('session_id')
    leave_room(session_id)
    emit('left_session', {'session_id': session_id})

@socketio.on("start_simulation")
def handle_start_simulation(data):
    session_id = data.get('session_id')
    chart_type = data.get('chart_type','line')
    interval = data.get('interval',1000)

    thread = Thread(target=simulate_live_data,args=(session_id,chart_type,interval))
    thread.daemon = True
    thread.start()
    emit('simulation_started',{'session_id':session_id})

def simulate_live_data(session_id,chart_type,interval):
    start_time = time.time()
    data_points = []

    while time.time() - start_time < 120:
        timestamp = time.strftime('%H:%M:%S')
        value = random.randint(10,100)

        data_point = {
            'timestamp' : timestamp,
            'value' : value,
            'label': f'point {len(data_points) + 1}'
        }

        data_points.append(data_point)

        socketio.emit('new_data_point',
                      {'data': data_point,'session_id':session_id},
                      room = session_id)
        
        time.sleep(interval/1000.0)

@socketio.on('upload_live_dataset')
def handle_live_dataset_upload(data):
    dataset_id = data.get('dataset_id')
    session_id = data.get('session_id')

    try:
        dataset = Dataset.query.get(dataset_id)
        if dataset and data.user_id == current_user.id:
            preview_data = dataset.get_preview_data()

            emit('dataset_loaded',{
                'session_id': session_id,
                'dataset_id':dataset.to_dict()
            })
        else:
            emit('error',{'message':'Dataset not found for unauthorised'})
    except Exception as e:
        emit('error',{'message':str(e)})
        
if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    socketio.run(app, debug=True, allow_unsafe_werkzeug=True)