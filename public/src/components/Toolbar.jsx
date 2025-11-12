// src/components/Toolbar.jsx
const {
  IUpload, IDownload, IFileUp, ITrash, IMinimize, IPlus,
  IFolderOpen, IList, INetwork
} = window;

const { memo } = React;

const Toolbar = memo(({
  keywords,
  tree,
  threshold,
  loading,
  onCSV,
  setThreshold,
  autoGroup,
  addGroup,
  exportJSON,
  importJSON,
  collapseAll,
  clearAll,
  activeView,
  setActiveView
}) => {
  return (
    <div className="glass-dark backdrop-blur-xl border-b border-white/20 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto p-4">
        <div className="flex flex-wrap gap-3 items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl">
              <IFolderOpen size={28} className="text-white"/>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Organizador de Keywords</h1>
              <p className="text-white/70 text-sm">Agrupa y organiza con IA</p>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap items-center">
            <label className="px-4 py-2 bg-white text-indigo-600 rounded-lg cursor-pointer hover:bg-gray-100 transition-all flex items-center gap-2 font-medium shadow-lg tooltip"
                   data-tooltip="Cargar archivo CSV">
              <IUpload size={18}/> Cargar CSV
              <input type="file" accept=".csv" onChange={onCSV} className="hidden"/>
            </label>

            {keywords.length > 0 && (
              <>
                <div className="flex items-center gap-3 glass px-4 py-2 rounded-lg text-white">
                  <span className="text-sm font-medium">Threshold</span>
                  <input type="range" min="0.5" max="1.0" step="0.05"
                         value={threshold}
                         onChange={(e) => setThreshold(parseFloat(e.target.value))}
                         className="w-24"/>
                  <span className="text-sm font-bold bg-white/20 px-2 py-1 rounded">{threshold.toFixed(2)}</span>
                </div>

                <button onClick={autoGroup} disabled={loading}
                        className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium shadow-lg">
                  {loading ? '⏳ Agrupando...' : '✨ Crear Agrupación'}
                </button>
              </>
            )}

            <button onClick={addGroup}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all flex items-center gap-2 font-medium shadow-lg tooltip"
                    data-tooltip="Agregar grupo manualmente">
              <IPlus size={18}/> Grupo
            </button>

            <button onClick={exportJSON} disabled={!tree.length}
                    className="p-2 bg-white/10 text-white rounded-lg hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all tooltip"
                    data-tooltip="Exportar JSON">
              <IDownload size={20}/>
            </button>

            <label className="p-2 bg-white/10 text-white rounded-lg cursor-pointer hover:bg-white/20 transition-all tooltip"
                   data-tooltip="Importar JSON">
              <IFileUp size={20}/>
              <input type="file" accept=".json" onChange={importJSON} className="hidden"/>
            </label>

            <button onClick={collapseAll} disabled={!tree.length}
                    className="p-2 bg-white/10 text-white rounded-lg hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all tooltip"
                    data-tooltip="Colapsar todo">
              <IMinimize size={20}/>
            </button>

            <button onClick={clearAll} disabled={!tree.length && !keywords.length}
                    className="p-2 bg-red-500/80 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all tooltip"
                    data-tooltip="Borrar todo">
              <ITrash size={20}/>
            </button>
          </div>
        </div>

        {tree.length > 0 && (
          <div className="flex gap-2">
            <button
              onClick={() => setActiveView('tree')}
              className={`tab-button flex items-center gap-2 ${activeView === 'tree' ? 'active' : ''}`}
            >
              <IList size={18}/>
              Vista de Árbol
            </button>
            <button
              onClick={() => setActiveView('flow')}
              className={`tab-button flex items-center gap-2 ${activeView === 'flow' ? 'active' : ''}`}
            >
              <INetwork size={18}/>
              Vista de Flujo
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

window.Toolbar = Toolbar;

