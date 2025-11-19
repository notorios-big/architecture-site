// src/components/KeywordModal.jsx
import React from 'react';
import { nodeVolume } from '../lib/tree.js';
import { IX } from '../lib/icons';

const KeywordModal = ({ keywordModal, setKeywordModal }) => {
  if (!keywordModal) return null;

  return (
    <div className="modal-overlay" onClick={() => setKeywordModal(null)}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold text-gray-800">{keywordModal.name}</h3>
              <p className="text-sm text-gray-600 mt-1">
                {keywordModal.children?.filter(c => !c.isGroup).length || 0} keywords ·
                {' '}{nodeVolume(keywordModal).toLocaleString('es-CL')} volumen total
              </p>
            </div>
            <button
              onClick={() => setKeywordModal(null)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-all"
            >
              <IX size={20} className="text-gray-600"/>
            </button>
          </div>
        </div>
        <div className="p-6 overflow-auto max-h-[60vh] scrollbar-thin">
          <div className="space-y-2">
            {keywordModal.children
              ?.filter(c => !c.isGroup)
              .sort((a, b) => (b.volume || 0) - (a.volume || 0))
              .map(kw => (
                <div key={kw.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-all">
                  <span className="text-gray-800">{kw.keyword}</span>
                  <span className="px-3 py-1 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-full text-sm font-bold">
                    {(kw.volume || 0).toLocaleString('es-CL')}
                  </span>
                </div>
              ))}
          </div>
        </div>
        <div className="p-4 border-t border-gray-200 flex justify-end">
          <button
            onClick={() => setKeywordModal(null)}
            className="px-6 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg hover:from-indigo-600 hover:to-purple-700 transition-all font-medium"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default KeywordModal;
