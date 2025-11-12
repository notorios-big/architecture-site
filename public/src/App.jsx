const { useState, useEffect, useMemo, useCallback, useRef } = React;

// Storage
const storage = {
  data: {},
  ok: false,
  init() {
    try {
      const k='__t__'; localStorage.setItem(k,k); localStorage.removeItem(k); this.ok=true;
    } catch { this.ok=false; }
  },
  getItem(k){ return this.ok? localStorage.getItem(k) : (this.data[k]??null); },
  setItem(k,v){ this.ok? localStorage.setItem(k,v) : (this.data[k]=v); },
  removeItem(k){ this.ok? localStorage.removeItem(k) : delete this.data[k]; }
};
storage.init();

// Icons
const Icon = ({d,size=20,className=""}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2" strokeLinecap="round"
       strokeLinejoin="round" className={className}><path d={d}/></svg>
);
const IUpload = (p)=> <Icon {...p} d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>;
const IDownload = (p)=> <Icon {...p} d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>;
const IFileUp = (p)=> <Icon {...p} d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M14 2v6h6M12 18v-6M9 15l3-3 3 3"/>;
const ITrash = (p)=> <Icon {...p} d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>;
const IEdit = (p)=> <Icon {...p} d="M17 3a2.8 2.8 0 0 1 4 4L7.5 21.5 2 22l1.5-5.5L17 3z"/>;
const ICheck = (p)=> <Icon {...p} d="M20 6L9 17l-5-5"/>;
const IX = (p)=> <Icon {...p} d="M18 6L6 18M6 6l12 12"/>;
const IChevronR = (p)=> <Icon {...p} d="M9 18l6-6-6-6"/>;
const IChevronD = (p)=> <Icon {...p} d="M6 9l6 6 6-6"/>;
const IMinimize = (p)=> <Icon {...p} d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>;
const IPlus = (p)=> <Icon {...p} d="M12 5v14M5 12h14"/>;
const IFolderOpen = (p)=> <Icon {...p} d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>;
const IEye = (p)=> <Icon {...p} d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/>;
const IList = (p)=> <Icon {...p} d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>;
const INetwork = (p)=> <Icon {...p} d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>;

// Hacer los iconos globales para que FlowView pueda acceder
window.IUpload = IUpload;
window.IDownload = IDownload;
window.IFileUp = IFileUp;
window.ITrash = ITrash;
window.IEdit = IEdit;
window.ICheck = ICheck;
window.IX = IX;
window.IChevronR = IChevronR;
window.IChevronD = IChevronD;
window.IMinimize = IMinimize;
window.IPlus = IPlus;
window.IFolderOpen = IFolderOpen;
window.IEye = IEye;
window.IList = IList;
window.INetwork = INetwork;

// Utils
const uid = (prefix='id') => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const parseCSV = (text) => {
  const clean = text.replace(/^\uFEFF/,'').replace(/\r\n/g,'\n').replace(/\r/g,'\n');
  const lines = clean.split('\n').map(l=>l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const rows = lines.slice(1);
  const out = [];
  rows.forEach((line)=>{
    let keyword='', volume='0';
    if (line.includes('"')) {
      const parts=[]; let cur='', inQ=false;
      for (const ch of line) {
        if (ch === '"') inQ = !inQ;
        else if (ch === ',' && !inQ){ parts.push(cur); cur=''; }
        else cur += ch;
      }
      parts.push(cur);
      keyword = (parts[0]??'').trim();
      volume  = (parts[1]??'0').trim();
    } else {
      const parts = line.split(',').map(s=>s.trim());
      keyword = parts[0]??'';
      volume  = parts[1]??'0';
    }
    if (keyword) out.push({
      id: uid('kw'),
      keyword,
      volume: Number(volume.replace(/\./g,'').replace(/\s/g,'')) || 0,
      isGroup: false
    });
  });
  return out;
};

// Cache de volúmenes global
const volumeCacheRef = { current: new Map() };

// Función para calcular volumen de grupo SOLO con keywords directas
const directGroupVolume = (node) => {
  if (!node.children) return 0;
  // Solo sumar las keywords directas (NO sumar subgrupos)
  return node.children.reduce((sum, child) => {
    // Si es un grupo, NO lo sumamos (solo keywords directas)
    if (child?.isGroup) return sum;
    // Si es una keyword, la sumamos
    return sum + (child?.volume || 0);
  }, 0);
};

// Función para obtener volumen de un nodo
const nodeVolume = (node) => {
  if (!node?.isGroup) return node?.volume || 0;
  const cache = volumeCacheRef.current;
  const cached = cache.get(node.id);
  if (cached !== undefined) return cached;
  const vol = directGroupVolume(node);
  cache.set(node.id, vol);
  return vol;
};

// Hacer nodeVolume global para que FlowView pueda acceder
window.nodeVolume = nodeVolume;

// Función auxiliar para verificar si un nodo contiene un descendiente
const hasDescendant = (node, targetId) => {
  if (!node.children) return false;
  for (const child of node.children) {
    if (child.id === targetId) return true;
    if (child.isGroup && hasDescendant(child, targetId)) return true;
  }
  return false;
};

// Función auxiliar para ordenar solo un array de nodos (sin recursión)
const sortChildren = (nodes) => {
  return [...nodes].sort((a, b) => {
    const aIsGroup = !!a?.isGroup;
    const bIsGroup = !!b?.isGroup;
    if (aIsGroup !== bIsGroup) return aIsGroup ? 1 : -1;
    
    const volA = nodeVolume(a);
    const volB = nodeVolume(b);
    if (volB !== volA) return volB - volA;
    
    const labelA = (aIsGroup ? (a.name || '') : (a.keyword || '')).toLowerCase();
    const labelB = (bIsGroup ? (b.name || '') : (b.keyword || '')).toLowerCase();
    return labelA.localeCompare(labelB);
  });
};

// Función para ordenar solo un nodo específico y sus ancestros
const sortOnlyAffectedNode = (tree, targetId) => {
  const walkAndSort = (nodes) => {
    return nodes.map(n => {
      const isTarget = n.id === targetId;
      const hasTargetInChildren = n.children && n.children.some(child => 
        child.id === targetId || (child.isGroup && hasDescendant(child, targetId))
      );
      
      if (n.isGroup && n.children) {
        const updatedChildren = walkAndSort(n.children);
        
        if (isTarget || hasTargetInChildren) {
          return {
            ...n,
            children: sortChildren(updatedChildren)
          };
        }
        
        return { ...n, children: updatedChildren };
      }
      return n;
    });
  };
  
  const sorted = walkAndSort(tree);
  return sortChildren(sorted);
};

function App(){
  const [keywords,setKeywords] = useState([]);
  const [tree,setTree] = useState(()=>{
    const raw = storage.getItem('keywordTree');
    if (!raw) return [];
    try { return JSON.parse(raw); } catch { return []; }
  });

  const [threshold,setThreshold] = useState(Number(storage.getItem('threshold')||0.8));
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState('');
  const [success,setSuccess] = useState('');
  const [dragging,setDragging] = useState(null);
  const [dragOver,setDragOver] = useState(null);
  const [editingId,setEditingId] = useState(null);
  const [editingText,setEditingText] = useState('');
  const [selectedNodes, setSelectedNodes] = useState(new Set());

  const [activeView, setActiveView] = useState('tree');
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [keywordModal, setKeywordModal] = useState(null);

  useEffect(()=>{ storage.setItem('threshold', String(threshold)); },[threshold]);
  useEffect(()=>{ storage.setItem('keywordTree', JSON.stringify(tree)); },[tree]);
  useEffect(()=>{ if(success){ const t = setTimeout(()=>setSuccess(''), 3000); return ()=>clearTimeout(t); } },[success]);

  const onCSV = (e)=>{
    const f = e.target.files?.[0]; if(!f) return;
    const reader = new FileReader();
    reader.onerror = ()=> setError('Error al leer el archivo CSV');
    reader.onload = (ev)=>{
      try{
        const kws = parseCSV(String(ev.target.result||''));
        if (!kws.length){ setError('CSV inválido: no hay filas válidas.'); return; }
        setKeywords(kws);
        const sortedKws = [...kws].sort((a, b) => (b.volume || 0) - (a.volume || 0));
        const root = {
          id:'root',
          name:'Sin agrupar',
          isGroup:true,
          collapsed:false,
          children: sortedKws
        };
        setTree([root]);
        setError('');
        setSuccess(`${kws.length} keywords cargadas exitosamente`);
      }catch(err){ setError('Error al procesar CSV: '+(err?.message||err)); }
    };
    reader.readAsText(f);
  };

  const serverBase = (location.protocol === 'file:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1') 
    ? 'http://localhost:3000' 
    : '';

  const getEmbeddingsBatch = async (texts) => {
    const resp = await fetch(`${serverBase}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts })
    });

    if (!resp.ok) {
      let msg = 'HTTP ' + resp.status;
      try { const e = await resp.json(); msg = e?.error || msg; } catch {}
      throw new Error('Servidor: ' + msg);
    }

    const data = await resp.json();
    const arr = data?.embeddings;
    if (!Array.isArray(arr) || !Array.isArray(arr[0])) {
      throw new Error('Respuesta sin embeddings válidos');
    }
    return arr;
  };

  const cosine = (a,b)=>{
    let dp=0, ma=0, mb=0;
    for(let i=0;i<a.length;i++){ const x=a[i], y=b[i]; dp+=x*y; ma+=x*x; mb+=y*y; }
    return dp/(Math.sqrt(ma)*Math.sqrt(mb));
  };

  const sortGroupChildren = useCallback((nodes) => {
    volumeCacheRef.current.clear();
    
    const sortedNodes = [...nodes].sort((a, b) => {
      const aIsGroup = !!a?.isGroup;
      const bIsGroup = !!b?.isGroup;
      if (aIsGroup !== bIsGroup) return aIsGroup ? 1 : -1;
      const volA = nodeVolume(a);
      const volB = nodeVolume(b);
      if (volB !== volA) return volB - volA;
      const labelA = (aIsGroup ? (a.name || '') : (a.keyword || '')).toLowerCase();
      const labelB = (bIsGroup ? (b.name || '') : (b.keyword || '')).toLowerCase();
      return labelA.localeCompare(labelB);
    }).map(n => {
      if (n.isGroup && n.children) {
        return { ...n, children: sortGroupChildren(n.children) };
      }
      return n;
    });
    return sortedNodes;
  }, []);

  const autoGroup = async () => {
    if (!keywords.length) {
      setError('Primero carga un CSV.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const texts = keywords.map(k => k.keyword);
      const embeddings = await getEmbeddingsBatch(texts);
      const withEmbeds = keywords.map((kw, i) => ({ ...kw, embedding: embeddings[i] }));

      // 1. Calcular matriz de similitud completa
      const similarities = [];
      for (let i = 0; i < withEmbeds.length; i++) {
        similarities[i] = [];
        for (let j = 0; j < withEmbeds.length; j++) {
          similarities[i][j] = cosine(withEmbeds[i].embedding, withEmbeds[j].embedding);
        }
      }

      // 2. Calcular centralidad (degree) de cada keyword
      // Cuántas conexiones >= threshold tiene cada una
      const degrees = withEmbeds.map((kw, i) => {
        const degree = similarities[i].filter(s => s >= threshold).length - 1; // -1 para no contar consigo misma
        return { index: i, degree };
      });

      // 3. Ordenar por centralidad descendente (más conectadas primero)
      degrees.sort((a, b) => b.degree - a.degree);

      // 4. Aplicar algoritmo greedy-clique con orden por centralidad
      const groups = [];
      const used = new Set();

      for (const { index: i } of degrees) {
        if (used.has(i)) continue;

        const base = withEmbeds[i];
        const g = [base];
        used.add(i);

        // Evaluar candidatos en orden de centralidad
        for (const { index: j } of degrees) {
          if (used.has(j)) continue;

          // Verificar que j forme un clique completo con todos los miembros de g
          let isClique = true;
          for (const member of g) {
            const memberIdx = withEmbeds.indexOf(member);
            if (similarities[memberIdx][j] < threshold) {
              isClique = false;
              break;
            }
          }

          if (isClique) {
            g.push(withEmbeds[j]);
            used.add(j);
          }
        }

        const top = g.reduce((m, x) => (x.volume > m.volume ? x : m), g[0]);
        groups.push({
          id: uid('group'),
          name: top.keyword,
          isGroup: true,
          collapsed: false,
          children: g.map(({ embedding, ...rest }) => rest),
        });
      }

      const sortedGroups = sortGroupChildren(groups);
      setTree(sortedGroups);
      setSuccess(`Agrupación completada: ${groups.length} grupos creados`);
    } catch (err) {
      setError('Error al agrupar: ' + (err?.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  // FUNCIÓN 1: Limpieza de grupos
  const cleanGroups = async () => {
    const onlyGroups = tree.filter(node => node.isGroup && node.name !== 'LLM-POR-CLASIFICAR');

    if (onlyGroups.length === 0) {
      setError('No hay grupos para limpiar.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const batchSize = 50;
      const batches = [];
      for (let i = 0; i < onlyGroups.length; i += batchSize) {
        batches.push(onlyGroups.slice(i, i + batchSize));
      }

      console.log(`🧹 Limpiando ${onlyGroups.length} grupos en ${batches.length} batches de ${batchSize}...`);

      let allKeywordsToClassify = [];
      let updatedTree = [...tree];

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        setSuccess(`Limpiando batch ${i + 1}/${batches.length}...`);

        const batchData = batch.map(group => ({
          id: group.id,
          name: group.name,
          volume: nodeVolume(group),
          keywords: (group.children || [])
            .filter(child => !child.isGroup)
            .map(child => ({
              keyword: child.keyword || child.name,
              volume: child.volume || 0
            }))
        }));

        const resp = await fetch(`${serverBase}/api/clean-groups`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            groups: batchData,
            batchIndex: i,
            totalBatches: batches.length
          })
        });

        if (!resp.ok) {
          let msg = 'HTTP ' + resp.status;
          try { const e = await resp.json(); msg = e?.error || msg; } catch {}
          throw new Error('Error al limpiar grupos: ' + msg);
        }

        const result = await resp.json();
        const suggestions = result.suggestions;

        // Aplicar limpiezas
        if (suggestions.cleanedGroups) {
          suggestions.cleanedGroups.forEach(cleaned => {
            const group = batch[cleaned.groupIndex];
            const groupIdx = updatedTree.findIndex(n => n.id === group.id);
            if (groupIdx === -1) return;

            // Mantener solo las keywords válidas
            const newChildren = (updatedTree[groupIdx].children || []).filter(child => {
              if (child.isGroup) return true;
              const kwText = child.keyword || child.name;
              return cleaned.keepKeywords.includes(kwText);
            });

            // Calcular el nuevo título usando la keyword de mayor volumen
            const keywordsOnly = newChildren.filter(c => !c.isGroup);
            const topKeyword = keywordsOnly.reduce((max, kw) => {
              return (kw.volume || 0) > (max.volume || 0) ? kw : max;
            }, keywordsOnly[0] || { keyword: group.name });

            updatedTree[groupIdx] = {
              ...updatedTree[groupIdx],
              name: topKeyword.keyword || group.name,
              children: newChildren
            };
          });
        }

        if (suggestions.toClassify) {
          allKeywordsToClassify.push(...suggestions.toClassify);
        }

        if (i < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // Crear o actualizar grupo LLM-POR-CLASIFICAR (único)
      if (allKeywordsToClassify.length > 0) {
        // Buscar grupo existente (debe ser grupo, no keyword)
        const toClassifyGroup = updatedTree.find(n =>
          n.isGroup && n.name === 'LLM-POR-CLASIFICAR'
        );

        // Convertir keywords a objetos con volumen preservado
        const newKeywords = allKeywordsToClassify.map(kwData => {
          // Si ya viene como objeto (del servidor nuevo), usarlo directo
          if (typeof kwData === 'object' && kwData.keyword) {
            return {
              id: uid('kw'),
              keyword: kwData.keyword,
              volume: kwData.volume || 0,
              isGroup: false
            };
          }
          // Si viene como string (legacy), crear con volumen 0
          return {
            id: uid('kw'),
            keyword: kwData,
            volume: 0,
            isGroup: false
          };
        });

        if (toClassifyGroup) {
          // Actualizar grupo existente
          const idx = updatedTree.findIndex(n => n.id === toClassifyGroup.id);
          updatedTree[idx] = {
            ...toClassifyGroup,
            children: [...(toClassifyGroup.children || []), ...newKeywords]
          };
        } else {
          // Crear nuevo grupo SOLO si no existe
          updatedTree.push({
            id: uid('group'),
            name: 'LLM-POR-CLASIFICAR',
            isGroup: true,
            collapsed: false,
            children: newKeywords
          });
        }
      }

      const sortedTree = sortGroupChildren(updatedTree);
      setTree(sortedTree);
      setSuccess(`Limpieza completada. ${allKeywordsToClassify.length} keywords movidas a LLM-POR-CLASIFICAR`);
    } catch (err) {
      setError('Error al limpiar grupos: ' + (err?.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  // FUNCIÓN 2: Clasificar keywords desde LLM-POR-CLASIFICAR
  const classifyKeywords = async () => {
    const toClassifyGroup = tree.find(n => n.name === 'LLM-POR-CLASIFICAR');

    if (!toClassifyGroup || !toClassifyGroup.children || toClassifyGroup.children.length === 0) {
      setError('No hay keywords en el grupo LLM-POR-CLASIFICAR para clasificar.');
      return;
    }

    const otherGroups = tree.filter(n => n.isGroup && n.name !== 'LLM-POR-CLASIFICAR');
    if (otherGroups.length === 0) {
      setError('No hay otros grupos para clasificar las keywords.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const keywordsToClassify = toClassifyGroup.children.filter(c => !c.isGroup);
      console.log(`🎯 Clasificando ${keywordsToClassify.length} keywords...`);

      // 1. Generar embeddings para todas las keywords y grupos
      setSuccess('Generando embeddings...');
      const allKeywords = keywordsToClassify.map(k => k.keyword);
      const groupRepresentatives = otherGroups.map(g => g.name);

      const keywordEmbeddings = await getEmbeddingsBatch(allKeywords);
      const groupEmbeddings = await getEmbeddingsBatch(groupRepresentatives);

      let updatedTree = [...tree];
      let classifiedCount = 0;
      let newGroupsCreated = 0;
      const classifiedKeywordIds = new Set(); // Rastrear keywords clasificadas por ID

      // 2. Procesar keywords en batches de 15
      const BATCH_SIZE = 15;
      const totalBatches = Math.ceil(keywordsToClassify.length / BATCH_SIZE);

      for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
        const batchStart = batchIdx * BATCH_SIZE;
        const batchEnd = Math.min(batchStart + BATCH_SIZE, keywordsToClassify.length);
        const currentBatch = keywordsToClassify.slice(batchStart, batchEnd);

        setSuccess(`Clasificando batch ${batchIdx + 1}/${totalBatches} (${currentBatch.length} keywords)...`);
        console.log(`\n🎯 Procesando batch ${batchIdx + 1}/${totalBatches}: ${currentBatch.length} keywords`);

        // 2.1 Preparar datos del batch con pre-filtro de embeddings
        const keywordsBatch = currentBatch.map((kw, localIdx) => {
          const globalIdx = batchStart + localIdx;
          const kwEmbed = keywordEmbeddings[globalIdx];

          // Pre-filtro con embeddings
          const similarities = groupEmbeddings.map((gEmbed, idx) => ({
            index: idx,
            similarity: cosine(kwEmbed, gEmbed),
            group: otherGroups[idx]
          }));

          const candidates = similarities
            .filter(s => s.similarity > 0.3)
            .sort((a, b) => b.similarity - a.similarity);

          console.log(`   📊 "${kw.keyword}": ${candidates.length} candidatos (similitud > 0.3)`);

          if (candidates.length === 0) {
            return null; // Se filtrará después
          }

          // Preparar candidatos para el LLM
          const candidateGroups = candidates.map((c, mappedIndex) => ({
            index: mappedIndex,
            name: c.group.name,
            similarity: c.similarity,
            sampleKeywords: (c.group.children || [])
              .filter(child => !child.isGroup)
              .slice(0, 5)
              .map(child => child.keyword || child.name)
          }));

          return {
            keyword: kw.keyword,
            keywordObj: kw,
            candidateGroups,
            candidatesRaw: candidates // Guardamos los candidatos originales para mapeo
          };
        }).filter(Boolean); // Remover nulls (keywords sin candidatos)

        if (keywordsBatch.length === 0) {
          console.log(`   ⚠️ Batch sin candidatos válidos, saltando...`);
          continue;
        }

        // 2.2 Llamar al LLM con el batch
        const resp = await fetch(`${serverBase}/api/classify-keywords-batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keywordsBatch })
        });

        if (!resp.ok) {
          console.warn(`⚠️ Error clasificando batch ${batchIdx + 1}, saltando...`);
          continue;
        }

        const result = await resp.json();
        const classifications = result.classifications || [];

        console.log(`   ✅ Recibidas ${classifications.length} clasificaciones del LLM`);

        // 2.3 Aplicar clasificaciones
        for (const classification of classifications) {
          const batchItem = keywordsBatch[classification.batchIndex];
          if (!batchItem) continue;

          const kw = batchItem.keywordObj;
          const candidates = batchItem.candidatesRaw;

          console.log(`   → Clasificando "${kw.keyword}": grupo ${classification.selectedGroupIndex}`);

          if (classification.selectedGroupIndex !== -1) {
            // Validar índice
            if (classification.selectedGroupIndex >= candidates.length) {
              console.warn(`      ⚠️ Índice inválido ${classification.selectedGroupIndex}, saltando...`);
              continue;
            }

            // Mover a grupo existente
            const targetCandidate = candidates[classification.selectedGroupIndex];
            const targetGroup = targetCandidate.group;
            const targetIdx = updatedTree.findIndex(n => n.id === targetGroup.id);

            if (targetIdx !== -1) {
              updatedTree[targetIdx] = {
                ...updatedTree[targetIdx],
                children: [...(updatedTree[targetIdx].children || []), kw]
              };
              classifiedKeywordIds.add(kw.id);
              classifiedCount++;
              console.log(`      ✅ Movida a "${targetGroup.name}"`);
            }
          } else if (classification.suggestedGroupName) {
            // Crear nuevo grupo
            const newGroup = {
              id: uid('group'),
              name: classification.suggestedGroupName,
              isGroup: true,
              collapsed: false,
              children: [kw]
            };
            updatedTree.push(newGroup);

            // Generar embedding para el nuevo grupo
            otherGroups.push(newGroup);
            const newGroupEmbed = await getEmbeddingsBatch([newGroup.name]);
            groupEmbeddings.push(newGroupEmbed[0]);

            classifiedKeywordIds.add(kw.id);
            newGroupsCreated++;
            classifiedCount++;

            console.log(`      ✨ Nuevo grupo creado: "${classification.suggestedGroupName}"`);
          }
        }

        // Pequeña pausa entre batches
        if (batchIdx < totalBatches - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // 3. Actualizar grupo LLM-POR-CLASIFICAR (remover clasificados)
      const classifyGroupIdx = updatedTree.findIndex(n => n.id === toClassifyGroup.id);
      if (classifyGroupIdx !== -1) {
        // Filtrar keywords que NO fueron clasificadas
        const remainingKeywords = keywordsToClassify.filter(kw => !classifiedKeywordIds.has(kw.id));

        if (remainingKeywords.length === 0) {
          // Eliminar el grupo si está vacío
          updatedTree.splice(classifyGroupIdx, 1);
        } else {
          updatedTree[classifyGroupIdx] = {
            ...updatedTree[classifyGroupIdx],
            children: remainingKeywords
          };
        }

        console.log(`📊 Keywords restantes en LLM-POR-CLASIFICAR: ${remainingKeywords.length}`);
      }

      const sortedTree = sortGroupChildren(updatedTree);
      setTree(sortedTree);
      setSuccess(`Clasificadas ${classifiedCount} keywords. ${newGroupsCreated} nuevos grupos creados.`);
    } catch (err) {
      setError('Error al clasificar keywords: ' + (err?.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  // FUNCIÓN 3: Generar jerarquías padre-hijo
  const generateHierarchies = async () => {
    const onlyGroups = tree.filter(node => node.isGroup);

    if (onlyGroups.length < 2) {
      setError('Se necesitan al menos 2 grupos para generar jerarquías.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      setSuccess('Analizando jerarquías...');

      const groupsData = onlyGroups.map(group => ({
        id: group.id,
        name: group.name,
        volume: nodeVolume(group),
        keywords: (group.children || [])
          .filter(child => !child.isGroup)
          .map(child => child.keyword || child.name)
      }));

      const resp = await fetch(`${serverBase}/api/generate-hierarchies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groups: groupsData })
      });

      if (!resp.ok) {
        let msg = 'HTTP ' + resp.status;
        try { const e = await resp.json(); msg = e?.error || msg; } catch {}
        throw new Error('Error al generar jerarquías: ' + msg);
      }

      const result = await resp.json();
      const suggestions = result.suggestions;

      if (!suggestions.hierarchies || suggestions.hierarchies.length === 0) {
        setSuccess('No se encontraron jerarquías válidas para crear.');
        setLoading(false);
        return;
      }

      // Aplicar jerarquías
      let updatedTree = [...tree];

      suggestions.hierarchies.forEach(hierarchy => {
        const parentGroup = onlyGroups[hierarchy.parentIndex];
        const childrenGroups = hierarchy.childrenIndices.map(idx => onlyGroups[idx]);

        const parentIdx = updatedTree.findIndex(n => n.id === parentGroup.id);
        if (parentIdx === -1) return;

        // Mover grupos hijos dentro del padre
        const movedChildren = childrenGroups.map(child => {
          const childInTree = updatedTree.find(n => n.id === child.id);
          return childInTree;
        }).filter(Boolean);

        // Actualizar padre con hijos
        updatedTree[parentIdx] = {
          ...updatedTree[parentIdx],
          children: [
            ...(updatedTree[parentIdx].children || []),
            ...movedChildren
          ]
        };

        // Remover hijos del nivel raíz
        updatedTree = updatedTree.filter(n =>
          !hierarchy.childrenIndices.some(idx => onlyGroups[idx].id === n.id)
        );
      });

      const sortedTree = sortGroupChildren(updatedTree);
      setTree(sortedTree);
      setSuccess(`${suggestions.hierarchies.length} jerarquías creadas exitosamente.`);
    } catch (err) {
      setError('Error al generar jerarquías: ' + (err?.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  const toggleCollapse = (id)=>{
    const walk=(nodes)=> nodes.map(n=>{
      if (n.id===id) return {...n, collapsed: !n.collapsed};
      if (n.children) return {...n, children: walk(n.children)};
      return n;
    });
    setTree(prev=>walk(prev));
  };
  
  const collapseAll = ()=>{
    const walk=(nodes)=> nodes.map(n=>{
      if (n.isGroup) {
        const collapsed = {...n, collapsed: true};
        if (n.children) return {...collapsed, children: walk(n.children)};
        return collapsed;
      }
      return n;
    });
    setTree(prev=>walk(prev));
  };
  
  const renameNode = (id, name)=>{
    const walk=(nodes)=> nodes.map(n=>{
      if (n.id===id) return {...n, name};
      if (n.children) return {...n, children: walk(n.children)};
      return n;
    });
    setTree(prev=>walk(prev));
  };
  
  const deleteNode = (id)=>{
    const del=(nodes)=> nodes
      .filter(n=> n.id!==id)
      .map(n=> n.children? ({...n, children: del(n.children)}) : n);
    setTree(prev=>del(prev));
  };

  const isDescendant = (rootId, target)=>{
    if (!target?.children) return false;
    for(const ch of target.children){
      if (ch.id===rootId) return true;
      if (isDescendant(rootId, ch)) return true;
    }
    return false;
  };

  const findNode = (id, nodes)=>{
    for(const n of nodes){
      if (n.id===id) return n;
      if (n.children){ const x = findNode(id,n.children); if(x) return x; }
    } return null;
  };
  
  const removeNode = (id, nodes)=>{
    let removed=null;
    const walk=(arr)=>{
      const out=[];
      for(const n of arr){
        if (n.id===id){ removed=n; continue; }
        if (n.children){
          const res = walk(n.children);
          out.push({...n, children: res.arr});
          if (res.removed) removed = res.removed;
        } else out.push(n);
      }
      return {arr: out, removed};
    };
    return walk(nodes);
  };
  
  const insertInto = (targetId, node, nodes)=>{
    const walk=(arr)=> arr.map(n=>{
      if (n.id===targetId){
        const kids = n.children? [...n.children, node] : [node];
        return {...n, children: kids};
      }
      if (n.children) return {...n, children: walk(n.children)};
      return n;
    });
    return walk(nodes);
  };

  const toggleNodeSelection = useCallback((nodeId, isGroup) => {
    if (isGroup) return; // No permitir seleccionar grupos
    setSelectedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  const onDrop = useCallback((target, dragged)=>{
    if (!target.isGroup) return;
    if (target.id===dragged.id) return;

    // Si hay nodos seleccionados y el nodo arrastrado está seleccionado, mover todos los seleccionados
    const nodesToMove = selectedNodes.has(dragged.id) && selectedNodes.size > 0
      ? Array.from(selectedNodes)
      : [dragged.id];

    setTree(prevTree => {
      let currentTree = prevTree;

      for (const nodeId of nodesToMove) {
        const draggedTreeNode = findNode(nodeId, currentTree);
        if (!draggedTreeNode) continue;
        if (isDescendant(target.id, draggedTreeNode)) continue;
        if (isDescendant(draggedTreeNode.id, target)) continue;
        if (target.id === nodeId) continue;

        const removed = removeNode(draggedTreeNode.id, currentTree);
        currentTree = insertInto(target.id, draggedTreeNode, removed.arr);
      }

      // Limpiar TODO el cache de volúmenes después de mover nodos
      // Esto asegura que todos los grupos recalculen su volumen correctamente
      // considerando solo sus keywords directas (no subgrupos)
      volumeCacheRef.current.clear();

      const sortedTree = sortOnlyAffectedNode(currentTree, target.id);
      return sortedTree;
    });

    // Limpiar selección después de mover
    setSelectedNodes(new Set());

    const count = nodesToMove.length;
    setSuccess(`${count} nodo${count > 1 ? 's' : ''} movido${count > 1 ? 's' : ''} correctamente`);
  }, [selectedNodes]);

  const addGroup = ()=>{
    const g = { id: uid('group'), name:'Nuevo Grupo', isGroup:true, collapsed:false, children:[] };
    setTree(prev=> Array.isArray(prev)? [...prev, g] : [g]);
    setError('');
    setSuccess('Nuevo grupo creado');
  };

  const exportJSON = ()=>{
    const blob = new Blob([JSON.stringify(tree,null,2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href=url; a.download='keyword-tree.json'; a.click();
    URL.revokeObjectURL(url);
    setSuccess('Archivo exportado correctamente');
  };
  
  const importJSON = (e)=>{
    const f = e.target.files?.[0]; if(!f) return;
    const reader = new FileReader();
    reader.onerror = ()=> setError('Error al leer JSON');
    reader.onload = (ev)=>{
      try{
        const obj=JSON.parse(String(ev.target.result||''));
        if (!Array.isArray(obj)) throw new Error('Estructura inválida (se esperaba un array)');
        const sorted = sortGroupChildren(obj);
        setTree(sorted); setError('');
        setSuccess('Archivo importado correctamente');
      }catch(err){ setError('Import inválido: '+(err?.message||err)); }
    };
    reader.readAsText(f);
  };

  const clearAll = ()=>{
    if (!window.confirm('¿Estás seguro de que quieres borrar todo? Esta acción no se puede deshacer.')) {
      return;
    }
    setKeywords([]);
    setTree([]);
    setError('');
    setSuccess('Todo ha sido eliminado');
  };

  const toggleFlowNode = useCallback((nodeId) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);


  return (
    <div className="min-h-screen pb-8">
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

              {keywords.length>0 && (
                <>
                  <div className="flex items-center gap-3 glass px-4 py-2 rounded-lg text-white">
                    <span className="text-sm font-medium">Threshold</span>
                    <input type="range" min="0.5" max="1.0" step="0.05"
                           value={threshold}
                           onChange={(e)=>setThreshold(parseFloat(e.target.value))}
                           className="w-24"/>
                    <span className="text-sm font-bold bg-white/20 px-2 py-1 rounded">{threshold.toFixed(2)}</span>
                  </div>

                  <button onClick={autoGroup} disabled={loading}
                          className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium shadow-lg">
                    {loading? '⏳ Agrupando...':'✨ Crear Agrupación'}
                  </button>
                </>
              )}

              {tree.filter(n => n.isGroup).length > 0 && (
                <>
                  <button onClick={cleanGroups} disabled={loading}
                          className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:from-blue-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium shadow-lg tooltip"
                          data-tooltip="Limpia grupos y mueve keywords huérfanas a LLM-POR-CLASIFICAR">
                    {loading? '🧹 Limpiando...':'🧹 1. Limpiar Grupos'}
                  </button>

                  {tree.find(n => n.name === 'LLM-POR-CLASIFICAR' && n.children?.length > 0) && (
                    <button onClick={classifyKeywords} disabled={loading}
                            className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg hover:from-purple-600 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium shadow-lg tooltip"
                            data-tooltip="Clasifica keywords desde LLM-POR-CLASIFICAR usando embeddings + LLM">
                      {loading? '🎯 Clasificando...':'🎯 2. Clasificar Keywords'}
                    </button>
                  )}

                  <button onClick={generateHierarchies} disabled={loading}
                          className="px-4 py-2 bg-gradient-to-r from-green-500 to-teal-600 text-white rounded-lg hover:from-green-600 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium shadow-lg tooltip"
                          data-tooltip="Genera conexiones padre-hijo entre grupos">
                    {loading? '🌳 Generando...':'🌳 3. Generar Jerarquías'}
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

      {error && (
        <div className="max-w-7xl mx-auto mt-4 px-6 animate-fade-in">
          <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-lg shadow-lg flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {success && (
        <div className="max-w-7xl mx-auto mt-4 px-6 animate-fade-in">
          <div className="p-4 bg-green-50 border-l-4 border-green-500 text-green-700 rounded-lg shadow-lg flex items-center gap-3">
            <span className="text-2xl">✅</span>
            <span>{success}</span>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto p-6">
        {tree.length===0 ? (
          <div className="glass rounded-2xl p-12 text-center shadow-2xl animate-fade-in">
            <div className="inline-block p-6 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full mb-6">
              <IUpload size={64} className="text-indigo-600"/>
            </div>
            <h2 className="text-3xl font-bold text-gray-800 mb-3">¡Comienza aquí!</h2>
            <p className="text-xl text-gray-600 mb-2">Carga un archivo CSV para comenzar a organizar</p>
            <p className="text-sm text-gray-500">Formato esperado: keyword, volumen</p>
          </div>
        ) : (
          <>
            {activeView === 'tree' && window.TreeView && (
              <window.TreeView
                tree={tree}
                dragging={dragging}
                dragOver={dragOver}
                editingId={editingId}
                editingText={editingText}
                selectedNodes={selectedNodes}
                setDragging={setDragging}
                setDragOver={setDragOver}
                setEditingId={setEditingId}
                setEditingText={setEditingText}
                toggleNodeSelection={toggleNodeSelection}
                toggleCollapse={toggleCollapse}
                renameNode={renameNode}
                deleteNode={deleteNode}
                onDrop={onDrop}
              />
            )}

            {activeView === 'flow' && window.FlowView && (
              <window.FlowView
                tree={tree}
                expandedNodes={expandedNodes}
                toggleFlowNode={toggleFlowNode}
                renameNode={renameNode}
                deleteNode={deleteNode}
                setKeywordModal={setKeywordModal}
                onMoveNode={(sourceId, targetId) => {
                  // Implementar lógica para mover nodos en el diagrama de flujo
                  const source = findNode(sourceId, tree);
                  const target = findNode(targetId, tree);

                  if (source && target) {
                    onDrop(target, source);
                  }
                }}
              />
            )}
          </>
        )}
      </div>

      {tree.length > 0 && (
        <div className="max-w-7xl mx-auto px-6 mt-4">
          <div className="glass rounded-xl p-4 flex gap-6 justify-center text-center">
            <div>
              <div className="text-2xl font-bold text-indigo-600">{tree.length}</div>
              <div className="text-sm text-gray-600">Grupos</div>
            </div>
            <div className="border-l border-gray-300"></div>
            <div>
              <div className="text-2xl font-bold text-purple-600">
                {tree.reduce((sum, node) => sum + (node.children?.length || 0), 0)}
              </div>
              <div className="text-sm text-gray-600">Keywords</div>
            </div>
            <div className="border-l border-gray-300"></div>
            <div>
              <div className="text-2xl font-bold text-green-600">
                {tree.reduce((sum, node) => sum + nodeVolume(node), 0).toLocaleString('es-CL')}
              </div>
              <div className="text-sm text-gray-600">Volumen Total</div>
            </div>
          </div>
        </div>
      )}

      {keywordModal && (
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
      )}
    </div>
  );
}

window.App = App;