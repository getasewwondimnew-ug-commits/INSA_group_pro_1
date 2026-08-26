from flask import Flask, render_template, jsonify, request, redirect, url_for
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
import jwt
import json
import os
from datetime import datetime, timezone, timedelta
from functools import wraps

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///orders.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET'] = 'abyssinian-meal-jwt-secret-key-2026'
app.config['JWT_EXPIRY_HOURS'] = 8

db = SQLAlchemy(app)


# ── Models ────────────────────────────────────────────────────────────────────

class Admin(db.Model):
    __tablename__ = 'admins'
    id       = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)  # bcrypt hash
    role     = db.Column(db.String(20), default='admin')

    def to_dict(self):
        return {'id': self.id, 'username': self.username, 'role': self.role}


class MenuItem(db.Model):
    __tablename__ = 'menu_items'
    id       = db.Column(db.Integer, primary_key=True)
    item_id  = db.Column(db.String(80), unique=True, nullable=False)
    name     = db.Column(db.String(255), nullable=False)
    desc     = db.Column(db.Text, nullable=False)
    price    = db.Column(db.Float, nullable=False)
    img      = db.Column(db.String(255), nullable=False)
    category = db.Column(db.String(80), nullable=False)

    def to_dict(self):
        return {
            'id': self.id, 'item_id': self.item_id,
            'name': self.name, 'desc': self.desc,
            'price': self.price, 'img': self.img,
            'category': self.category,
        }


class Order(db.Model):
    __tablename__ = 'orders'
    id            = db.Column(db.Integer, primary_key=True)
    customer_name = db.Column(db.String(255), nullable=False)
    items         = db.Column(db.Text, nullable=False)
    quantity      = db.Column(db.Integer, nullable=False)
    total_price   = db.Column(db.Float, nullable=False)
    status        = db.Column(db.String(50), default='pending')
    created_at    = db.Column(db.DateTime, default=datetime.now)

    def to_dict(self):
        return {
            'id': self.id, 'customer_name': self.customer_name,
            'items': self.items, 'quantity': self.quantity,
            'total_price': self.total_price, 'status': self.status,
            'created_at': self.created_at.isoformat(),
        }


# ── DB seed ───────────────────────────────────────────────────────────────────

SEED_MENU = [
    {'item_id':'bruschetta',     'name':'Classic Bruschetta',    'desc':'Toasted sourdough topped with vine tomatoes, fresh basil, and a drizzle of extra-virgin olive oil.','price':8.5,  'img':'img/image1.png','category':'starters'},
    {'item_id':'mushroom-soup',  'name':'Cream of Mushroom Soup','desc':'Rich, velvety mushroom soup with a swirl of cream and fresh thyme garnish.',                       'price':7.0,  'img':'img/image2.png','category':'starters'},
    {'item_id':'shrimp-cocktail','name':'Shrimp Cocktail',       'desc':'Chilled jumbo shrimp served with house-made cocktail sauce and lemon wedges.',                      'price':13.0, 'img':'img/image3.png','category':'starters'},
    {'item_id':'ribeye-steak',   'name':'Grilled Ribeye Steak',  'desc':'12 oz prime ribeye, seasoned and flame-grilled, served with roasted potatoes and seasonal vegetables.','price':38.0,'img':'img/image4.png','category':'main-course'},
    {'item_id':'pan-seared-salmon','name':'Pan-Seared Salmon',   'desc':'Atlantic salmon fillet with lemon-dill butter sauce, served over wild rice and steamed asparagus.','price':29.0, 'img':'img/image5.png','category':'main-course'},
    {'item_id':'truffle-pasta',  'name':'Truffle Pasta',         'desc':'House-made tagliatelle tossed in a black truffle cream sauce with parmesan and fresh parsley.',     'price':24.0, 'img':'img/image5.png','category':'main-course'},
    {'item_id':'roast-chicken',  'name':'Herb Roast Chicken',    'desc':'Half chicken slow-roasted with rosemary, garlic, and lemon, served with mashed potatoes and gravy.','price':22.0,'img':'img/image6.png','category':'desserts'},
    {'item_id':'lava-cake',      'name':'Chocolate Lava Cake',   'desc':'Warm dark chocolate fondant with a molten centre, served with vanilla bean ice cream.',             'price':11.0, 'img':'img/image7.png','category':'desserts'},
    {'item_id':'creme-brulee',   'name':'Crème Brûlée',          'desc':'Classic French custard with a crisp caramelised sugar crust, topped with fresh berries.',           'price':10.0, 'img':'img/image8.png','category':'desserts'},
    {'item_id':'cheesecake',     'name':'New York Cheesecake',   'desc':'Dense and creamy cheesecake on a buttery graham cracker base with a fresh strawberry compote.',     'price':9.5,  'img':'img/image9.png','category':'desserts'},
]

with app.app_context():
    db.create_all()
    # Seed default admin (username: admin  password: admin123)
    if not Admin.query.first():
        db.session.add(Admin(
            username='admin',
            password=generate_password_hash('admin123'),
            role='admin',
        ))
        db.session.commit()
    # Seed menu items
    if not MenuItem.query.first():
        for m in SEED_MENU:
            db.session.add(MenuItem(**m))
        db.session.commit()


# ── JWT helpers ───────────────────────────────────────────────────────────────

def create_token(admin):
    payload = {
        'id': admin.id,
        'username': admin.username,
        'role': admin.role,
        'exp': datetime.now(timezone.utc) + timedelta(hours=app.config['JWT_EXPIRY_HOURS']),
    }
    return jwt.encode(payload, app.config['JWT_SECRET'], algorithm='HS256')


def decode_token(token):
    return jwt.decode(token, app.config['JWT_SECRET'], algorithms=['HS256'])


def get_token_from_request():
    auth = request.headers.get('Authorization', '')
    if auth.startswith('Bearer '):
        return auth[7:]
    return request.cookies.get('admin_token')


def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = get_token_from_request()
        if not token:
            return jsonify({'error': 'Missing token'}), 401
        try:
            payload = decode_token(token)
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401
        if payload.get('role') != 'admin':
            return jsonify({'error': 'Forbidden: admin role required'}), 403
        request.admin = payload
        return f(*args, **kwargs)
    return decorated


# ── Page routes ───────────────────────────────────────────────────────────────

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/cart.html')
def cart():
    return render_template('cart.html')

@app.route('/admin/login')
def admin_login_page():
    return render_template('admin_login.html')

@app.route('/admin')
@app.route('/admin/orders')
def admin_orders_page():
    return render_template('admin_orders.html')

@app.route('/admin/menu')
def admin_menu_page():
    return render_template('admin_add.html')


# ── Public API ────────────────────────────────────────────────────────────────

@app.route('/api/menu')
def get_menu():
    items = MenuItem.query.all()
    return jsonify([m.to_dict() for m in items])


@app.route('/api/orders', methods=['POST'])
def create_order():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data'}), 400
    items = data.get('items', [])
    if not items:
        return jsonify({'error': 'No items'}), 400
    customer_name = data.get('customer_name', 'Guest').strip() or 'Guest'
    total_qty   = sum(i.get('qty', i.get('quantity', 1)) for i in items)
    total_price = sum(i.get('price', 0) * i.get('qty', i.get('quantity', 1)) for i in items)
    order = Order(
        customer_name=customer_name,
        items=json.dumps(items),
        quantity=total_qty,
        total_price=total_price,
    )
    db.session.add(order)
    db.session.commit()
    return jsonify({'message': 'Order placed', 'order': order.to_dict()}), 201


@app.route('/api/order/<int:order_id>')
def get_order(order_id):
    order = db.session.get(Order, order_id)
    if not order:
        return jsonify({'error': 'Not found'}), 404
    return jsonify({'order': order.to_dict()})


# ── Auth API ──────────────────────────────────────────────────────────────────

@app.route('/api/admin/login', methods=['POST'])
def admin_login():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data'}), 400
    username = data.get('username', '').strip()
    password = data.get('password', '')
    admin = Admin.query.filter_by(username=username).first()
    if not admin or not check_password_hash(admin.password, password):
        return jsonify({'error': 'Invalid credentials'}), 401
    token = create_token(admin)
    return jsonify({'token': token, 'admin': admin.to_dict()})


@app.route('/api/admin/verify')
@admin_required
def admin_verify():
    return jsonify({'admin': request.admin})


# ── Protected: Orders API ─────────────────────────────────────────────────────

@app.route('/api/admin/orders')
@admin_required
def admin_get_orders():
    orders = Order.query.order_by(Order.created_at.desc()).all()
    return jsonify({'orders': [o.to_dict() for o in orders]})


@app.route('/api/admin/orders/<int:order_id>/status', methods=['PUT'])
@admin_required
def admin_update_order_status(order_id):
    order = db.session.get(Order, order_id)
    if not order:
        return jsonify({'error': 'Not found'}), 404
    data = request.get_json() or {}
    status = data.get('status', '')
    if status not in ('pending', 'confirmed', 'completed', 'cancelled'):
        return jsonify({'error': 'Invalid status'}), 400
    order.status = status
    db.session.commit()
    return jsonify({'order': order.to_dict()})


@app.route('/api/admin/orders/<int:order_id>', methods=['DELETE'])
@admin_required
def admin_delete_order(order_id):
    order = db.session.get(Order, order_id)
    if not order:
        return jsonify({'error': 'Not found'}), 404
    db.session.delete(order)
    db.session.commit()
    return jsonify({'message': 'Deleted'})


# ── Protected: Menu API ───────────────────────────────────────────────────────

@app.route('/api/admin/menu', methods=['POST'])
@admin_required
def admin_add_menu_item():
    data = request.get_json() or {}
    required = ('item_id', 'name', 'desc', 'price', 'img', 'category')
    if not all(data.get(k) for k in required):
        return jsonify({'error': 'Missing fields'}), 400
    if MenuItem.query.filter_by(item_id=data['item_id']).first():
        return jsonify({'error': 'item_id already exists'}), 409
    item = MenuItem(**{k: data[k] for k in required})
    db.session.add(item)
    db.session.commit()
    return jsonify({'item': item.to_dict()}), 201


@app.route('/api/admin/menu/<int:item_id>', methods=['PUT'])
@admin_required
def admin_update_menu_item(item_id):
    item = db.session.get(MenuItem, item_id)
    if not item:
        return jsonify({'error': 'Not found'}), 404
    data = request.get_json() or {}
    for field in ('name', 'desc', 'price', 'img', 'category'):
        if field in data:
            setattr(item, field, data[field])
    db.session.commit()
    return jsonify({'item': item.to_dict()})


@app.route('/api/admin/menu/<int:item_id>', methods=['DELETE'])
@admin_required
def admin_delete_menu_item(item_id):
    item = db.session.get(MenuItem, item_id)
    if not item:
        return jsonify({'error': 'Not found'}), 404
    db.session.delete(item)
    db.session.commit()
    return jsonify({'message': 'Deleted'})


if __name__ == '__main__':
    app.run(debug=True)
