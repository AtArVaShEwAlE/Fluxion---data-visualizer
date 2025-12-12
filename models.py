from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
import json

db = SQLAlchemy()

class User(UserMixin, db.Model):
    """User model for authentication"""
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    full_name = db.Column(db.String(100), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)
    
    # Relationships
    datasets = db.relationship('Dataset', backref='owner', lazy=True, cascade='all, delete-orphan')
    charts = db.relationship('Chart', backref='owner', lazy=True, cascade='all, delete-orphan')
    
    def set_password(self, password):
        """Hash and set password"""
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        """Check if provided password matches hash"""
        return check_password_hash(self.password_hash, password)
    
    def to_dict(self):
        """Convert user to dictionary (excluding sensitive data)"""
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'full_name': self.full_name,
            'created_at': self.created_at.isoformat(),
            'datasets_count': len(self.datasets),
            'charts_count': len(self.charts)
        }
    
    def __repr__(self):
        return f'<User {self.username}>'


class Dataset(db.Model):
    """Dataset model for uploaded files"""
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(255), nullable=False)
    original_filename = db.Column(db.String(255), nullable=False)
    file_size = db.Column(db.Integer, nullable=False)  # in bytes
    rows = db.Column(db.Integer, nullable=False)
    columns = db.Column(db.Integer, nullable=False)
    column_names = db.Column(db.Text, nullable=False)  # JSON string
    data_types = db.Column(db.Text, nullable=False)    # JSON string
    preview_data = db.Column(db.Text, nullable=False)  # JSON string (first 10 rows)
    upload_date = db.Column(db.DateTime, default=datetime.utcnow)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    
    # Relationships
    charts = db.relationship('Chart', backref='dataset', lazy=True, cascade='all, delete-orphan')
    
    def set_column_names(self, column_list):
        """Store column names as JSON"""
        self.column_names = json.dumps(column_list)
    
    def get_column_names(self):
        """Retrieve column names from JSON"""
        return json.loads(self.column_names)
    
    def set_data_types(self, types_dict):
        """Store data types as JSON"""
        self.data_types = json.dumps(types_dict)
    
    def get_data_types(self):
        """Retrieve data types from JSON"""
        return json.loads(self.data_types)
    
    def set_preview_data(self, preview_list):
        """Store preview data as JSON"""
        self.preview_data = json.dumps(preview_list)
    
    def get_preview_data(self):
        """Retrieve preview data from JSON"""
        return json.loads(self.preview_data)
    
    def to_dict(self):
        """Convert dataset to dictionary"""
        return {
            'id': self.id,
            'filename': self.original_filename,
            'file_size': self.file_size,
            'rows': self.rows,
            'columns': self.columns,
            'column_names': self.get_column_names(),
            'data_types': self.get_data_types(),
            'preview': self.get_preview_data(),
            'upload_date': self.upload_date.isoformat()
        }
    
    def __repr__(self):
        return f'<Dataset {self.original_filename}>'


class Chart(db.Model):
    """Chart model for saved visualizations"""
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    chart_type = db.Column(db.String(50), nullable=False)  # bar, line, pie, scatter
    config = db.Column(db.Text, nullable=False)  # JSON string with chart configuration
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_public = db.Column(db.Boolean, default=False)
    share_token = db.Column(db.String(64), unique=True, nullable=True)  # Unique token for sharing
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    dataset_id = db.Column(db.Integer, db.ForeignKey('dataset.id'), nullable=False)
    
    def generate_share_token(self):
        """Generate a unique share token"""
        import secrets
        self.share_token = secrets.token_urlsafe(32)
        return self.share_token
    
    def set_config(self, config_dict):
        """Store chart configuration as JSON"""
        self.config = json.dumps(config_dict)
    
    def get_config(self):
        """Retrieve chart configuration from JSON"""
        return json.loads(self.config)
    
    def to_dict(self):
        """Convert chart to dictionary"""
        return {
            'id': self.id,
            'title': self.title,
            'chart_type': self.chart_type,
            'config': self.get_config(),
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'is_public': self.is_public,
            'share_token': self.share_token,
            'dataset': self.dataset.to_dict() if self.dataset else None
        }
    
    def __repr__(self):
        return f'<Chart {self.title}>'