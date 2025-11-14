// src/views/FlowView.jsx
const { useState, useEffect, useRef } = React;
const { nodeVolume } = window;
const {
  IFolderOpen, ITrash, IEdit, ICheck, IChevronR, IChevronD, IEye
} = window;

const FlowView = ({
  tree,
  expandedNodes,
  toggleFlowNode,
  renameNode,
  deleteNode,
  promoteToRoot,
  setKeywordModal,
  onMoveNode
}) => {
  const containerRef = useRef(null);
  const editorRef = useRef(null);
  const [isDrawflowReady, setIsDrawflowReady] = useState(false);
  const isRenderingRef = useRef(false); // Flag para indicar si estamos renderizando

  // Verificar que Drawflow esté disponible
  useEffect(() => {
    console.log('Drawflow disponible:', typeof window.Drawflow !== 'undefined');

    if (typeof window.Drawflow === 'undefined') {
      console.error('Drawflow no está cargado. Verifica el CDN.');
      return;
    }

    setIsDrawflowReady(true);
  }, []);

  // Exponer callbacks globalmente para que el HTML los pueda usar
  useEffect(() => {
    window.flowCallbacks = {
      toggleNode: (nodeId) => {
        console.log('Toggle node:', nodeId);
        toggleFlowNode(nodeId);
      },
      showKeywords: (nodeId) => {
        console.log('Show keywords:', nodeId);
        const node = findNodeById(tree, nodeId);
        if (node) setKeywordModal(node);
      },
      deleteNode: (nodeId) => {
        console.log('Delete node:', nodeId);
        if (confirm('¿Eliminar este nodo?')) {
          deleteNode(nodeId);
        }
      },
      promoteToRoot: (nodeId) => {
        console.log('Promote to root:', nodeId);
        if (promoteToRoot) {
          promoteToRoot(nodeId);
        }
      },
      zoomIn: () => {
        if (editorRef.current) {
          editorRef.current.zoom_in();
        }
      },
      zoomOut: () => {
        if (editorRef.current) {
          editorRef.current.zoom_out();
        }
      },
      zoomReset: () => {
        if (editorRef.current) {
          editorRef.current.zoom_reset();
        }
      }
    };

    return () => {
      delete window.flowCallbacks;
    };
  }, [tree, toggleFlowNode, deleteNode, promoteToRoot, setKeywordModal]);

  // Función auxiliar para encontrar un nodo por ID
  const findNodeById = (nodes, id) => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children) {
        const found = findNodeById(node.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  // Generar HTML para un nodo
  const generateNodeHTML = (node, hasParent = false) => {
    const volume = nodeVolume(node);
    const isExpanded = expandedNodes.has(node.id);

    const childGroups = node.isGroup && node.children
      ? node.children.filter(c => c.isGroup)
      : [];
    const hasChildGroups = childGroups.length > 0;

    const keywordCount = node.isGroup && node.children
      ? node.children.filter(c => !c.isGroup).length
      : 0;

    const nodeName = node.name || node.keyword || 'Sin nombre';

    return `
      <div class="custom-node">
        <div style="display: flex; flex-direction: column; gap: 10px; padding: 4px;">
          <!-- Header -->
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>

              <span class="flex-1 text-white font-semibold text-sm" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                ${nodeName}
              </span>
            </div>

            <div style="display: flex; gap: 4px; flex-shrink: 0;">
              ${hasParent && node.isGroup ? `
                <button
                  onclick="window.flowCallbacks.promoteToRoot('${node.id}')"
                  style="padding: 4px; border-radius: 4px; transition: all 0.2s;"
                  onmouseover="this.style.background='rgba(255,255,255,0.2)'"
                  onmouseout="this.style.background='transparent'"
                  title="Promover a raíz"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 19V5M5 12l7-7 7 7"/>
                  </svg>
                </button>
              ` : ''}

              <button
                onclick="window.flowCallbacks.deleteNode('${node.id}')"
                style="padding: 4px; border-radius: 4px; transition: all 0.2s;"
                onmouseover="this.style.background='rgba(255,255,255,0.2)'"
                onmouseout="this.style.background='transparent'"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- Metrics -->
          <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: white;">
            <div style="background: rgba(255,255,255,0.2); padding: 5px 10px; border-radius: 16px; font-weight: bold; white-space: nowrap;">
              ${volume.toLocaleString('es-CL')} vol.
            </div>
            ${node.isGroup && keywordCount > 0 ? `
              <div style="background: rgba(255,255,255,0.2); padding: 5px 10px; border-radius: 16px; white-space: nowrap;">
                ${keywordCount} KWs
              </div>
            ` : ''}
          </div>

          <!-- Actions -->
          <div style="display: flex; gap: 6px; align-items: center;">
            ${hasChildGroups ? `
              <button
                onclick="window.flowCallbacks.toggleNode('${node.id}')"
                style="flex: 1; padding: 6px 10px; background: rgba(255,255,255,0.2); border-radius: 6px; color: white; font-size: 12px; font-weight: 500; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 6px; border: none; cursor: pointer; min-height: 32px;"
                onmouseover="this.style.background='rgba(255,255,255,0.3)'; this.style.transform='translateY(-1px)'"
                onmouseout="this.style.background='rgba(255,255,255,0.2)'; this.style.transform='translateY(0)'"
              >
                ${isExpanded ? '▼ Contraer' : '▶ Expandir'}
              </button>
            ` : ''}

            ${node.isGroup && keywordCount > 0 ? `
              <button
                onclick="window.flowCallbacks.showKeywords('${node.id}')"
                style="flex: 1; padding: 6px 10px; background: rgba(255,255,255,0.2); border-radius: 6px; color: white; font-size: 12px; font-weight: 500; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 6px; border: none; cursor: pointer; min-height: 32px;"
                onmouseover="this.style.background='rgba(255,255,255,0.3)'; this.style.transform='translateY(-1px)'"
                onmouseout="this.style.background='rgba(255,255,255,0.2)'; this.style.transform='translateY(0)'"
              >
                👁 Ver KWs
              </button>
            ` : ''}

          </div>
        </div>
      </div>
    `;
  };

  // Inicializar y actualizar Drawflow
  useEffect(() => {
    if (!isDrawflowReady || !containerRef.current) return;

    console.log('Inicializando Drawflow...');
    console.log('expandedNodes:', Array.from(expandedNodes));

    // Limpiar editor anterior si existe
    if (editorRef.current) {
      try {
        console.log('Limpiando editor anterior...');
        editorRef.current.clear();
        editorRef.current = null;
      } catch (e) {
        console.error('Error al limpiar editor:', e);
      }
    }

    // Limpiar contenedor
    containerRef.current.innerHTML = '';

    // Crear elemento para Drawflow
    const drawflowDiv = document.createElement('div');
    drawflowDiv.id = 'drawflow';
    containerRef.current.appendChild(drawflowDiv);

    // Inicializar Drawflow
    try {
      const editor = new Drawflow(drawflowDiv);
      editor.reroute = true;
      editor.start();

      editorRef.current = editor;

      console.log('Drawflow inicializado correctamente');

      // Event listeners para capturar conexiones manuales del usuario
      editor.on('connectionCreated', (info) => {
        // Si estamos renderizando, ignorar el evento (es una conexión programática)
        if (isRenderingRef.current) {
          console.log('🔗 Conexión programática ignorada:', info);
          return;
        }

        console.log('🔗 Conexión creada manualmente por usuario:', info);

        // info contiene: { output_id, input_id, output_class, input_class }
        // Necesitamos obtener los node.id originales de los nodos de Drawflow

        const outputNode = editor.drawflow.drawflow.Home.data[info.output_id];
        const inputNode = editor.drawflow.drawflow.Home.data[info.input_id];

        if (outputNode && inputNode) {
          // El name del nodo tiene formato "node-{id}", extraemos el id original
          const sourceId = outputNode.name?.replace('node-', '');
          const targetId = inputNode.name?.replace('node-', '');

          console.log(`  → Moviendo nodo ${targetId} como hijo de ${sourceId}`);

          if (sourceId && targetId && onMoveNode) {
            // Llamar a onMoveNode para actualizar el árbol
            onMoveNode(targetId, sourceId);
          }
        }
      });

      editor.on('connectionRemoved', (info) => {
        console.log('🔗❌ Conexión eliminada:', info);
        // Por ahora solo logueamos, podrías implementar lógica para desconectar nodos
      });

      // Construir el diagrama
      const HORIZONTAL_SPACING = 400;
      const VERTICAL_SPACING = 150;
      const levelPositions = new Map();
      const nodeIdMap = new Map(); // Mapeo de node.id a drawflow node id
      const connections = []; // Array para guardar las conexiones a crear

      const traverse = (node, level = 0, parentId = null) => {
        if (!node) return;

        const isExpanded = expandedNodes.has(node.id);

        console.log(`Procesando nodo: ${node.name || node.keyword}, Level: ${level}, Parent: ${parentId}, Expanded: ${isExpanded}`);

        // Calcular posición
        if (!levelPositions.has(level)) {
          levelPositions.set(level, []);
        }

        const usedPositions = levelPositions.get(level);
        const yPosition = usedPositions.length * VERTICAL_SPACING + 50;
        usedPositions.push(yPosition);

        const xPosition = level * HORIZONTAL_SPACING + 50;

        // Generar HTML del nodo
        const html = generateNodeHTML(node, parentId !== null);

        // Agregar nodo a Drawflow y capturar el ID real que devuelve
        const currentDrawflowId = editor.addNode(
          `node-${node.id}`,  // name
          1,                   // inputs - tiene 1 input para poder conectar
          1,                   // outputs
          xPosition,
          yPosition,
          `node-${node.id}`,  // class
          {},                  // data
          html                 // html
        );

        nodeIdMap.set(node.id, currentDrawflowId);

        console.log(`  → Nodo agregado con Drawflow ID: ${currentDrawflowId} en posición (${xPosition}, ${yPosition})`);

        // Guardar la conexión para crearla después
        if (parentId !== null) {
          const parentDrawflowId = nodeIdMap.get(parentId);
          connections.push({
            from: parentDrawflowId,
            to: currentDrawflowId,
            parentName: parentId,
            childName: node.id
          });
          console.log(`  → Conexión pendiente: ${parentDrawflowId} -> ${currentDrawflowId}`);
        }

        // Procesar hijos si está expandido
        if (node.isGroup && node.children) {
          const childGroups = node.children.filter(c => c.isGroup);
          console.log(`  → Tiene ${childGroups.length} grupos hijos`);

          if (isExpanded && childGroups.length > 0) {
            console.log(`  → Procesando hijos porque está expandido`);
            childGroups.forEach(child => {
              traverse(child, level + 1, node.id);
            });
          } else if (!isExpanded && childGroups.length > 0) {
            console.log(`  → NO procesando hijos porque NO está expandido`);
          }
        }
      };

      // PASO 1: Procesar todos los nodos raíz y agregar todos los nodos
      console.log('\n📍 PASO 1: Agregando todos los nodos...');
      tree.forEach(node => traverse(node));

      // PASO 2: Crear todas las conexiones (activar flag para ignorar eventos)
      console.log(`\n🔗 PASO 2: Creando ${connections.length} conexiones...`);
      isRenderingRef.current = true; // Activar flag de renderizado
      connections.forEach(conn => {
        try {
          const success = editor.addConnection(
            conn.from,       // output_id
            conn.to,         // input_id
            'output_1',      // output_class
            'input_1'        // input_class
          );
          console.log(`  ✓ Conexión creada: ${conn.from} -> ${conn.to} (${conn.parentName} -> ${conn.childName}) - Success: ${success}`);
        } catch (err) {
          console.error(`  ✗ Error al crear conexión ${conn.from} -> ${conn.to}:`, err);
          console.error(`     Nodo ${conn.from} existe:`, !!editor.drawflow.drawflow.Home.data[conn.from]);
          console.error(`     Nodo ${conn.to} existe:`, !!editor.drawflow.drawflow.Home.data[conn.to]);
        }
      });

      // Desactivar flag de renderizado
      isRenderingRef.current = false;

      // Contar nodos y conexiones totales
      const totalNodes = Object.keys(editor.drawflow.drawflow.Home.data).length;
      const totalConnections = Object.keys(editor.drawflow.drawflow.Home.data).reduce((sum, key) => {
        const node = editor.drawflow.drawflow.Home.data[key];
        return sum + Object.keys(node.outputs?.output_1?.connections || {}).length;
      }, 0);

      console.log(`\n📊 Resumen:`);
      console.log(`Total de nodos agregados: ${totalNodes}`);
      console.log(`Total de conexiones: ${totalConnections}`);
      console.log(`Nodos en el drawflow:`, editor.drawflow.drawflow.Home.data);
      console.log(`\n✅ Renderizado completo. Ahora puedes crear conexiones manualmente.`);

    } catch (err) {
      console.error('Error al inicializar Drawflow:', err);
    }

    // Cleanup
    return () => {
      if (editorRef.current) {
        try {
          editorRef.current.clear();
        } catch (e) {
          console.error('Error al limpiar Drawflow:', e);
        }
      }
    };
  }, [tree, expandedNodes, isDrawflowReady]);

  if (!isDrawflowReady) {
    return (
      <div className="glass rounded-2xl shadow-2xl overflow-hidden animate-fade-in" style={{ height: 'calc(100vh - 280px)' }}>
        <div className="flex items-center justify-center h-full text-gray-600">
          <div className="text-center">
            <p className="text-lg font-semibold mb-2">Cargando Drawflow...</p>
            <p className="text-sm">Por favor espera un momento</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl shadow-2xl overflow-hidden animate-fade-in" style={{ height: 'calc(100vh - 280px)', position: 'relative' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
        {/* Drawflow se renderiza aquí */}
      </div>

      {/* Controles de zoom */}
      <div style={{
        position: 'absolute',
        left: '20px',
        bottom: '20px',
        display: 'flex',
        gap: '8px',
        zIndex: 10
      }}>
        <button
          onClick={() => window.flowCallbacks?.zoomOut()}
          style={{
            width: '40px',
            height: '40px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none',
            borderRadius: '8px',
            color: 'white',
            fontSize: '24px',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'scale(1.1)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.3)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
          }}
          title="Alejar"
        >
          −
        </button>

        <button
          onClick={() => window.flowCallbacks?.zoomReset()}
          style={{
            height: '40px',
            padding: '0 16px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none',
            borderRadius: '8px',
            color: 'white',
            fontSize: '12px',
            fontWeight: '600',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.3)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
          }}
          title="Restablecer zoom"
        >
          100%
        </button>

        <button
          onClick={() => window.flowCallbacks?.zoomIn()}
          style={{
            width: '40px',
            height: '40px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none',
            borderRadius: '8px',
            color: 'white',
            fontSize: '24px',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'scale(1.1)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.3)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
          }}
          title="Acercar"
        >
          +
        </button>
      </div>

      {/* Controles de ayuda */}
      <div style={{
        position: 'absolute',
        right: '20px',
        top: '20px',
        background: 'rgba(255, 255, 255, 0.95)',
        padding: '12px 16px',
        borderRadius: '12px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
        fontSize: '12px',
        zIndex: 10,
        maxWidth: '220px',
        backdropFilter: 'blur(10px)'
      }}>
        <strong style={{ fontSize: '13px', color: '#333' }}>💡 Controles:</strong><br/>
        <div style={{ marginTop: '8px', lineHeight: '1.6', color: '#555' }}>
          • Arrastra nodos para moverlos<br/>
          • Clic en Expandir para ver subgrupos<br/>
          • Usa los botones +/− para zoom<br/>
          • Arrastra el canvas para desplazarte
        </div>
      </div>
    </div>
  );
};

window.FlowView = FlowView;
