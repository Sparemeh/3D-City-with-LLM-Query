from flask import Flask, request, jsonify
from flask_cors import CORS
from models import db, User, Project
from data_fetcher import get_cached_buildings
from llm_service import parse_query
import json
import os

app = Flask(__name__)
CORS(app)

app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///city_dashboard.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)

with app.app_context():
    db.create_all()

_buildings_cache = None


def get_buildings():
    global _buildings_cache
    if _buildings_cache is None:
        _buildings_cache = get_cached_buildings()
    return _buildings_cache


def apply_filter(buildings, filter_spec):
    """Filter buildings by filter_spec and return matching IDs."""
    if not filter_spec:
        return []
    attr = filter_spec.get('attribute')
    operator = filter_spec.get('operator')
    value = filter_spec.get('value')

    matching_ids = []
    for building in buildings:
        props = building.get('properties', {})
        bval = props.get(attr)
        if bval is None:
            continue
        try:
            if operator == '>':
                if float(bval) > float(value):
                    matching_ids.append(building['id'])
            elif operator == '<':
                if float(bval) < float(value):
                    matching_ids.append(building['id'])
            elif operator == '>=':
                if float(bval) >= float(value):
                    matching_ids.append(building['id'])
            elif operator == '<=':
                if float(bval) <= float(value):
                    matching_ids.append(building['id'])
            elif operator == '==':
                if str(bval).lower() == str(value).lower():
                    matching_ids.append(building['id'])
            elif operator == 'contains':
                if str(value).lower() in str(bval).lower():
                    matching_ids.append(building['id'])
        except (ValueError, TypeError):
            pass
    return matching_ids


def describe_filter(filter_spec):
    if not filter_spec:
        return 'No filter'
    attr = filter_spec.get('attribute', '')
    op = filter_spec.get('operator', '')
    val = filter_spec.get('value', '')
    op_words = {
        '>': 'greater than', '<': 'less than',
        '>=': 'at least', '<=': 'at most',
        '==': 'equal to', 'contains': 'containing'
    }
    op_word = op_words.get(op, op)
    if attr == 'height':
        return f'Buildings with height {op_word} {val}m'
    if attr == 'assessed_value':
        try:
            return f'Buildings with assessed value {op_word} ${float(val):,.0f}'
        except (ValueError, TypeError):
            return f'Buildings with assessed value {op_word} {val}'
    if attr == 'zoning':
        return f'Buildings with zoning {op_word} {val}'
    if attr == 'building_type':
        return f'Buildings with type {op_word} {val}'
    return f'{attr} {op_word} {val}'


@app.route('/api/buildings', methods=['GET'])
def get_buildings_route():
    buildings = get_buildings()
    return jsonify(buildings)


@app.route('/api/query', methods=['POST'])
def query_route():
    data = request.get_json()
    query_text = data.get('query', '')
    hf_api_key = data.get('hf_api_key') or None

    if not query_text:
        return jsonify({'error': 'query is required'}), 400
    if not hf_api_key:
        return jsonify({'error': 'hf_api_key is required'}), 400

    try:
        filter_spec = parse_query(query_text, hf_api_key)
    except RuntimeError as e:
        return jsonify({'error': str(e)}), 502

    if not filter_spec:
        return jsonify({
            'filter_spec': None,
            'matching_ids': [],
            'description': 'Could not parse query. Try: "buildings over 50 meters" or "commercial buildings"'
        })

    buildings = get_buildings()
    matching_ids = apply_filter(buildings, filter_spec)
    description = describe_filter(filter_spec)

    return jsonify({
        'filter_spec': filter_spec,
        'matching_ids': matching_ids,
        'description': description
    })


@app.route('/api/users', methods=['POST'])
def upsert_user():
    data = request.get_json()
    username = data.get('username', '').strip()
    if not username:
        return jsonify({'error': 'username is required'}), 400

    user = User.query.filter_by(username=username).first()
    if not user:
        user = User(username=username)
        db.session.add(user)
        db.session.commit()

    return jsonify(user.to_dict())


@app.route('/api/projects/<username>', methods=['GET'])
def get_projects(username):
    user = User.query.filter_by(username=username).first()
    if not user:
        return jsonify([])
    projects = Project.query.filter_by(user_id=user.id).order_by(Project.created_at.desc()).all()
    return jsonify([p.to_dict() for p in projects])


@app.route('/api/projects', methods=['POST'])
def save_project():
    data = request.get_json()
    username = data.get('username', '').strip()
    name = data.get('name', '').strip()
    filters = data.get('filters', [])

    if not username or not name:
        return jsonify({'error': 'username and name are required'}), 400

    user = User.query.filter_by(username=username).first()
    if not user:
        user = User(username=username)
        db.session.add(user)
        db.session.commit()

    project = Project(
        name=name,
        user_id=user.id,
        filters=json.dumps(filters)
    )
    db.session.add(project)
    db.session.commit()

    return jsonify(project.to_dict()), 201


@app.route('/api/projects/<int:project_id>', methods=['DELETE'])
def delete_project(project_id):
    project = db.session.get(Project, project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    db.session.delete(project)
    db.session.commit()
    return jsonify({'message': 'Project deleted'})


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', debug=False, port=port)
