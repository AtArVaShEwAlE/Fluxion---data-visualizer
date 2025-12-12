from flask import Flask, render_template, request, jsonify, redirect, url_for, flash
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
import pandas as pd
import os
from werkzeug.utils import secure_filename
from datetime import datetime

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
        # BUG FIX: filer_by -> filter_by
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
        # BUG FIX: Don't reassign user variable
        user.set_password(form.password.data)
        db.session.add(user)
        db.session.commit()
        
        flash('Congratulations! Your account has been created.', 'success')
        return redirect(url_for('login'))
    
    # BUG FIX: render_template not url_for, and remove leading slash
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
        # BUG FIX: dataset -> datasets
        for dataset in current_user.datasets[-3:]:
            recent_activity.append({
                'icon': '📁',
                'text': f'Uploaded dataset "{dataset.original_filename}"',
                'time': dataset.upload_date.strftime('%B %d, %Y'),
            })
    
    return render_template('auth/profile.html',
                           form=form,
                           days_since_joined=days_since_joined,
                           recent_activity=recent_activity)

@app.route("/change-password", methods=['GET','POST'])
@login_required  # BUG FIX: Add @login_required decorator
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
    # Get user's recent datasets
    recent_datasets = Dataset.query.filter_by(user_id=current_user.id)\
                                   .order_by(Dataset.upload_date.desc())\
                                   .limit(5)\
                                   .all()
    
    # Format recent activity
    recent_activity = []
    for dataset in recent_datasets:
        recent_activity.append({
            'icon': '📁',
            'text': f'Uploaded "{dataset.original_filename}"',
            'time': dataset.upload_date.strftime('%B %d, %Y at %I:%M %p'),
            'id': dataset.id
        })
    
    return render_template('dashboard.html', recent_activity=recent_activity)

@app.route('/create-chart')
@login_required  # BUG FIX: Add @login_required decorator
def create_chart():
    """Chart creation interface"""
    return render_template('create_chart.html')

@app.route('/charts')
@login_required  # BUG FIX: Add @login_required decorator
def charts():
    user_charts = Chart.query.filter_by(user_id=current_user.id).order_by(Chart.created_at.desc()).all()
    return render_template('charts.html', charts=user_charts)

@app.route('/upload', methods=['POST'])
@login_required
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file selected'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if file and allowed_file(file.filename):
        try:
            filename = secure_filename(file.filename)
            # Add user ID and timestamp to make filename unique
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            unique_filename = f"{current_user.id}_{timestamp}_{filename}"
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
            file.save(filepath)
            
            # Read the file based on extension
            if filename.endswith('.csv'):
                df = pd.read_csv(filepath)
            else:  # Excel files
                df = pd.read_excel(filepath)
            
            # Clean the data - replace NaN values with empty strings
            df_clean = df.fillna('')
            
            # Create dataset record in database
            dataset = Dataset(
                filename=unique_filename,
                original_filename=filename,
                file_size=os.path.getsize(filepath),
                rows=len(df),
                columns=len(df.columns),
                user_id=current_user.id
            )
            dataset.set_column_names(df.columns.tolist())
            dataset.set_data_types(df.dtypes.astype(str).to_dict())
            dataset.set_preview_data(df_clean.head(10).to_dict('records'))
            
            db.session.add(dataset)
            db.session.commit()
            
            # Return the dataset info
            data_info = dataset.to_dict()
            
            return jsonify({
                'success': True,
                'data': data_info
            })
            
        except Exception as e:
            return jsonify({'error': f'Error processing file: {str(e)}'}), 500
    
    return jsonify({'error': 'Invalid file type. Please upload CSV or Excel files.'}), 400

@app.route('/save-chart', methods=['POST'])
@login_required
def save_chart():
    try:
        # BUG FIX: request.json() -> request.get_json()
        data = request.get_json()

        chart = Chart(
            title=data.get('title', 'Untitled Chart'),  # BUG FIX: Capital U
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
        return jsonify({'error': f'Error saving chart: {str(e)}'}), 500

@app.route('/delete-chart/<int:chart_id>', methods=['DELETE'])
@login_required
def delete_chart(chart_id):
    """Delete a chart"""
    try:
        chart = Chart.query.get_or_404(chart_id)
        
        # Check if chart belongs to current user
        if chart.user_id != current_user.id:
            return jsonify({'error': 'Unauthorized'}), 403
        
        db.session.delete(chart)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Chart deleted successfully!'
        })
        
    except Exception as e:
        return jsonify({'error': f'Error deleting chart: {str(e)}'}), 500

@app.route('/get-chart/<int:chart_id>', methods=['GET'])
@login_required
def get_chart(chart_id):
    """Get chart data for viewing"""
    try:
        chart = Chart.query.get_or_404(chart_id)
        
        # Check if chart belongs to current user
        if chart.user_id != current_user.id:
            return jsonify({'error': 'Unauthorized'}), 403
        
        # Get chart with dataset info
        chart_data = chart.to_dict()
        
        return jsonify({
            'success': True,
            'chart': chart_data
        })
        
    except Exception as e:
        return jsonify({'error': f'Error loading chart: {str(e)}'}), 500

@app.route('/download-dataset/<int:dataset_id>')
@login_required
def download_dataset(dataset_id):
    """Download dataset as CSV"""
    try:
        dataset = Dataset.query.get_or_404(dataset_id)
        
        # Check if dataset belongs to current user
        if dataset.user_id != current_user.id:
            return jsonify({'error': 'Unauthorized'}), 403
        
        # Get the file path
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], dataset.filename)
        
        # Check if file exists
        if not os.path.exists(filepath):
            return jsonify({'error': 'File not found'}), 404
        
        # Send file
        from flask import send_file
        return send_file(
            filepath,
            as_attachment=True,
            download_name=dataset.original_filename,
            mimetype='application/octet-stream'
        )
        
    except Exception as e:
        return jsonify({'error': f'Error downloading file: {str(e)}'}), 500

@app.route('/export-chart-pdf/<int:chart_id>')
@login_required
def export_chart_pdf(chart_id):
    """Export chart as PDF"""
    try:
        chart = Chart.query.get_or_404(chart_id)
        
        # Check if chart belongs to current user
        if chart.user_id != current_user.id:
            return jsonify({'error': 'Unauthorized'}), 403
        
        # This will be implemented with canvas-to-pdf conversion
        # For now, return a placeholder
        return jsonify({
            'success': False,
            'message': 'PDF export will be implemented via client-side conversion'
        })
        
    except Exception as e:
        return jsonify({'error': f'Error exporting PDF: {str(e)}'}), 500

# Add these routes BEFORE the "if __name__ == '__main__':" line in app.py

@app.route('/share-chart/<int:chart_id>', methods=['POST'])
@login_required
def share_chart(chart_id):
    """Generate shareable link for a chart"""
    try:
        chart = Chart.query.get_or_404(chart_id)
        
        # Check if chart belongs to current user
        if chart.user_id != current_user.id:
            return jsonify({'error': 'Unauthorized'}), 403
        
        # Generate share token if not exists
        if not chart.share_token:
            chart.generate_share_token()
        
        # Make chart public
        chart.is_public = True
        db.session.commit()
        
        # Generate shareable URL
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
        
        # Check if chart belongs to current user
        if chart.user_id != current_user.id:
            return jsonify({'error': 'Unauthorized'}), 403
        
        # Make chart private
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
        
        # Render shared chart page
        return render_template('shared_chart.html', chart=chart.to_dict())
        
    except Exception as e:
        return render_template('error.html', 
                             error='Chart not found or no longer shared',
                             message='This chart may have been made private or deleted.')
if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)