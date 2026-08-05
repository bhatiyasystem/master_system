
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import './index.css'
import store from './redux/store.js'
import App from './App.jsx'

window.__IS_MASTER_SYSTEM__ = true;

createRoot(document.getElementById('root')).render(
  <Provider store={store}>
    <App />
  </Provider>
)
