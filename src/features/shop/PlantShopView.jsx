import React from 'react';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { DiamondIcon } from '../../data/fallbackData';
import { Plant } from '../../components/common/Mascots';

export default function PlantShopView({ shop, loading, notice, onBack, onBuy, onSelect }) {
  return (
    <section className="plant-shop-page">
      <div className="page-toolbar plant-shop-toolbar">
        <div className="page-back-heading">
          <button className="fc2-back" onClick={onBack} aria-label="Về trang chủ"><ChevronLeft size={20} /></button>
          <div>
            <h2><DiamondIcon size={24} /> Cửa hàng cây</h2>
            <p>Đổi kim cương lấy cây đồng hành cho tiến độ giáo trình của bạn.</p>
          </div>
        </div>
        <div className="shop-balance"><DiamondIcon size={21} /><strong>{shop.balance.toLocaleString('vi-VN')}</strong><span>kim cương</span></div>
      </div>
      {notice && <div className={`shop-notice ${notice.type || 'info'}`}>{notice.message}</div>}
      <div className="plant-shop-grid">
        {shop.plants.map((plant) => (
          <article className={`plant-shop-card ${plant.selected ? 'selected' : ''}`} key={plant.id}>
            <div className="plant-shop-preview"><Plant progress={100} variant={plant.id} /></div>
            <div className="plant-shop-info">
              <span className="plant-shop-eyebrow">CÂY TIẾN ĐỘ</span>
              <h3>{plant.name}</h3>
              <p>{plant.description}</p>
            </div>
            {plant.selected ? (
              <button className="plant-shop-action selected" disabled><Check size={14} /> Đang sử dụng</button>
            ) : plant.owned ? (
              <button className="plant-shop-action choose" disabled={loading} onClick={() => onSelect(plant.id)}>Đổi sang cây này <ChevronRight size={16} /></button>
            ) : (
              <button className="plant-shop-action buy" disabled={loading || shop.balance < plant.price} onClick={() => onBuy(plant.id)}>
                <span className="plant-shop-action-label">Đổi cây</span>
                <span className="plant-shop-action-price"><DiamondIcon size={16} /> {plant.price.toLocaleString('vi-VN')}</span>
              </button>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
