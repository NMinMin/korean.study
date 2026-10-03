import { createRoot } from 'react-dom/client';
import { PreferencesProvider } from '../src/contexts/PreferencesContext';
import SettingsView from '../src/features/settings/SettingsView';
import '../src/index.css';
import '../src/styles/dashboard.css';
import '../src/styles/theme.css';
createRoot(document.getElementById('root')).render(<PreferencesProvider><div className="app"><main className="main"><SettingsView onBack={() => {}} vocabulary={[]} lesson={{ id: 'preview', no: 1 }} /></main></div></PreferencesProvider>);
