import type { ViewMode } from '../App';

interface Props {
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
  onAdd: () => void;
}

export default function Header({ view, onViewChange, onAdd }: Props): JSX.Element {
  return (
    <header className="header">
      <div className="title">Local App Manager</div>
      <div className="header-actions">
        <div className="view-toggle">
          <button
            className={view === 'grid' ? 'active' : ''}
            onClick={() => onViewChange('grid')}
            title="Grid view"
          >⊞ Grid</button>
          <button
            className={view === 'list' ? 'active' : ''}
            onClick={() => onViewChange('list')}
            title="List view"
          >☰ List</button>
        </div>
        <button className="add-btn" onClick={onAdd}>+ Add App</button>
      </div>
    </header>
  );
}
