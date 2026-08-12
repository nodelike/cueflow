import React from 'react'
import {createRoot} from 'react-dom/client'
import './style.css'
import App from './App'
import { applyTheme, getInitialTheme } from './lib/theme'

applyTheme(getInitialTheme())

const container = document.getElementById('root')

const root = createRoot(container!)

root.render(
    <React.StrictMode>
        <App/>
    </React.StrictMode>
)
