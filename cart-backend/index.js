const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const port = 3000;

// Middleware
app.use(bodyParser.json());
app.use(cors());

// Assuming this is a list of product returned from the backend API
let cartItems = [
  {
    id: '1',
    category: 'Lighting',
    name: 'Elegant Desk Lamp',
    price: 49.99,
    quantity: 0,
  },
  {
    id: '2',
    category: 'Furniture',
    name: 'Modern Armchair',
    price: 149.99,
    quantity: 0,
  },
  {
    id: '3',
    category: 'Lighting',
    name: 'Luminous Floor Lamp',
    price: 89.99,
    quantity: 0,
  },
  {
    id: '4',
    category: 'Furniture',
    name: 'Serenity Chaise Lounge',
    price: 278.99,
    quantity: 0,
  },
];

// Get cart items
app.get('/cart', (req, res) => {
  const { category } = req.query; // Access the category query parameter
  console.log('req.query:', req.query);

  let itemsToReturn = cartItems;

  // Filter items if a category query parameter is provided
  if (typeof category === 'string') {
    itemsToReturn = cartItems.filter(
      (item) => item.category.toLowerCase() === category.toLowerCase()
    );
  }

  const responseData = {
    status: 'success',
    result: itemsToReturn,
    request_id: '1da0b71884c83fe761f3b54f7c32874b',
  };

  res.json(responseData);
});

// Add item to cart or increase quantity if it already exists
app.post('/cart', (req, res) => {
  const newItem = req.body;
  // Find the item in the cart
  const existingItem = cartItems.find((item) => item.id === newItem.id);

  if (existingItem) {
    // Item already exists in the cart, so just increase the quantity
    existingItem.quantity = newItem.quantity;
  } else {
    // Item not in the cart, so add it with a quantity
    cartItems.push({ ...newItem, quantity: newItem.quantity || 0 }); // Ensure there's a default quantity
  }

  const responseData = {
    status: 'success',
    result: 'sucess',
    request_id: '1da0b71884c83fe761f3b54f7c32874b',
  };

  res.json(responseData);
});

// Remove item from cart
app.delete('/cart/:itemId', (req, res) => {
  const itemId = req.params.itemId;
  cartItems = cartItems.filter((item) => item.id !== itemId);
  res.status(204).send();
});

app.listen(port, () => {
  console.log(`Shopping cart backend listening at http://localhost:${port}`);
});
