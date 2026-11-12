import { createRoot } from 'react-dom/client';
import { MiniWidget } from './MiniWidget';
import { restoreStoredTheme } from '../logic/theme';
import './mini.css';

restoreStoredTheme();

const root = createRoot(document.getElementById('mini-root')!);
root.render(<MiniWidget />);
