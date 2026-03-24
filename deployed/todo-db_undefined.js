```javascript
// todo-db.js
const db = {};

const todos = [];

db.createTodo = (text) => {
  const todo = {
    id: Date.now(),
    text,
    completed: false,
  };
  todos.push(todo);
  return todo;
};

db.getTodos = () => todos;

db.getTodoById = (id) => todos.find((todo) => todo.id === id);

db.updateTodo = (id, updates) => {
  const index = todos.findIndex((todo) => todo.id === id);
  if (index !== -1) {
    todos[index] = { ...todos[index], ...updates };
    return todos[index];
  }
  return null;
};

db.deleteTodo = (id) => {
  const index = todos.findIndex((todo) => todo.id === id);
  if (index !== -1) {
    todos.splice(index, 1);
    return true;
  }
  return false;
};

module.exports = db;
```

```javascript
// todo-db.test.js
const db = require('./todo-db');

describe('Todo DB', () => {
  it('should create a new todo', () => {
    const todo = db.createTodo('Buy milk');
    expect(todo).toHaveProperty('id');
    expect(todo.text).toBe('Buy milk');
    expect(todo.completed).toBe(false);
  });

  it('should get all todos', () => {
    db.createTodo('Buy eggs');
    db.createTodo('Buy bread');
    const todos = db.getTodos();
    expect(todos).toHaveLength(3);
  });

  it('should get a todo by id', () => {
    const todo = db.createTodo('Buy milk');
    const foundTodo = db.getTodoById(todo.id);
    expect(foundTodo).toBe(todo);
  });

  it('should update a todo', () => {
    const todo = db.createTodo('Buy milk');
    const updatedTodo = db.updateTodo(todo.id, { text: 'Buy water', completed: true });
    expect(updatedTodo.text).toBe('Buy water');
    expect(updatedTodo.completed).toBe(true);
  });

  it('should delete a todo', () => {
    const todo = db.createTodo('Buy milk');
    const deleted = db.deleteTodo(todo.id);
    expect(deleted).toBe(true);
    expect(db.getTodoById(todo.id)).toBeUndefined();
  });
});
```