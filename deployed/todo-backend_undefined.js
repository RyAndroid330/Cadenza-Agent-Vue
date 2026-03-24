```javascript
// todo-backend/server.js
const express = require('express');
const app = express();
const port = 3000;

// In-memory database for simplicity
let todoItems = [
  { id: 1, title: 'Buy milk', completed: false },
  { id: 2, title: 'Walk the dog', completed: false },
];

// Middleware to parse JSON bodies
app.use(express.json());

// GET all todo items
app.get('/api/todos', (req, res) => {
  res.json(todoItems);
});

// GET a single todo item
app.get('/api/todos/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const item = todoItems.find((todo) => todo.id === id);
  if (!item) {
    res.status(404).json({ message: 'Todo item not found' });
  } else {
    res.json(item);
  }
});

// POST a new todo item
app.post('/api/todos', (req, res) => {
  const { title } = req.body;
  const newItem = {
    id: todoItems.length + 1,
    title,
    completed: false,
  };
  todoItems.push(newItem);
  res.json(newItem);
});

// PUT update a todo item
app.put('/api/todos/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const item = todoItems.find((todo) => todo.id === id);
  if (!item) {
    res.status(404).json({ message: 'Todo item not found' });
  } else {
    const { title, completed } = req.body;
    item.title = title;
    item.completed = completed;
    res.json(item);
  }
});

// DELETE a todo item
app.delete('/api/todos/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const index = todoItems.findIndex((todo) => todo.id === id);
  if (index === -1) {
    res.status(404).json({ message: 'Todo item not found' });
  } else {
    todoItems.splice(index, 1);
    res.json({ message: 'Todo item deleted' });
  }
});

app.listen(port, () => {
  console.log(`Todo backend listening on port ${port}`);
});
```