
import { createRoot } from 'react-dom/client'
import './index.css'

import store from './redux/store.js'


createRoot(document.getElementById('root')).render(
   
 <Provider store={store}>
   
    <App />
    
   
   </Provider>
)
