import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PreferencesProvider } from '../src/contexts/PreferencesContext';
import SettingsView from '../src/features/settings/SettingsView';
import AppCombobox from '../src/components/common/AppCombobox';
import CurriculumHubView from '../src/features/curriculum/CurriculumHubView';
import '../src/index.css';
import '../src/styles/dashboard.css';
import '../src/styles/theme.css';
function Preview() {
 const [filter,setFilter]=useState('all');
 const options=[{value:'all',label:'Tất cả giáo trình'},{value:'book',label:'세종한국어 회화 익힘책 1-1'}];
 return <PreferencesProvider><div className="app"><main className="main">
 <header className="app-page-header"><div className="app-page-heading"><h1>Giáo trình</h1><p>Kiểm tra giao diện sáng và tối</p></div></header>
 <SettingsView onBack={() => {}} vocabulary={[]} lesson={{id:'preview',no:1}} />
 <div className="lb-header-bar"><div className="lb-selector-wrap"><span>Giáo trình:</span><AppCombobox value={filter} options={options} onChange={setFilter}/></div><span>Đã chọn: {filter}</span></div>
 <CurriculumHubView myBooks={[{id:'book',title:options[1].label,name:options[1].label,hasContent:true,lessonCount:7}]} availableBooks={[]} onBack={()=>{}} onOpenBook={()=>{}} />
 <div className="content-library-controls"><label className="content-library-search"><input placeholder="Tìm từ vựng"/></label><label className="content-library-filter"><select><option>Tất cả giáo trình</option></select></label></div>
 <div className="vl-row"><div className="vl-main"><span className="vl-ko">우체국</span><span className="vl-vi">Bưu điện</span></div></div>
 <div className="recent-card"><div className="card-title">Hoạt động gần đây</div><p>Tiến độ học tập</p></div>
 </main></div></PreferencesProvider>;
}
createRoot(document.getElementById('root')).render(<Preview/>);
