import { createRoot } from 'react-dom/client';
import { MiniWidget } from './MiniWidget';
import './mini.css';

const root = createRoot(document.getElementById('mini-root')!);
root.render(<MiniWidget />);
