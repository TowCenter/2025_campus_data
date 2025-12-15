/**
 * Application Entry Point
 *
 * This file initializes the Svelte 5 application using the new mount API.
 * Svelte 5 replaced the legacy component instantiation (new App()) with
 * the mount function for better performance and consistency.
 */

import { mount } from 'svelte';
import App from './App.svelte';

// Mount the main App component to the document body
// Using Svelte 5's mount API instead of legacy new App() constructor
const app = mount(App, {
  target: document.body,
});

export default app;
