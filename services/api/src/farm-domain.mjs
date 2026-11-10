import { fields } from './commerce-domain.mjs';
import { invalid, text, uuid } from './domain.mjs';

export const elementTypes = ['CULTIVATION', 'VEGETABLE_GARDEN', 'ORCHARD', 'STORAGE', 'COLLECTION', 'OTHER'];
export function validateLayout(body) {
  fields(body, ['version', 'elements']);
  if (!Number.isSafeInteger(body.version) || body.version < 0 || body.version >= Number.MAX_SAFE_INTEGER) invalid('version: inteiro não negativo obrigatório.');
  if (!Array.isArray(body.elements) || body.elements.length > 20) invalid('elements: lista de até 20 elementos.');
  const ids = new Set();
  const elements = body.elements.map(e => {
    fields(e, ['id', 'name', 'type', 'position', 'productionIds', 'cropIds']);
    const id = uuid(e.id, 'element.id');
    if (ids.has(id.toLowerCase())) invalid('Identificador de elemento repetido.');
    ids.add(id.toLowerCase());
    if (!elementTypes.includes(e.type)) invalid('Tipo de elemento inválido.');
    fields(e.position, ['x', 'y']);
    for (const key of ['x', 'y']) if (typeof e.position[key] !== 'number' || !Number.isFinite(e.position[key]) || e.position[key] < 0 || e.position[key] > 1) invalid('Posições normalizadas entre 0 e 1.');
    const references = key => {
      if (!Array.isArray(e[key]) || e[key].length > 10) invalid(`${key}: lista obrigatória de até 10 UUIDs.`);
      const values = e[key].map(v => uuid(v, key));
      if (new Set(values.map(v => v.toLowerCase())).size !== values.length) invalid(`${key}: referências repetidas.`);
      return values;
    };
    return { id, name: text(e.name, 'element.name', 80), type: e.type, position: { x: e.position.x, y: e.position.y }, productionIds: references('productionIds'), cropIds: references('cropIds') };
  });
  return { version: body.version, elements };
}

export function layoutView(document, propertyId, canEdit) {
  return { propertyId, schemaVersion: 1, version: document?.version || 0,
    state: !document ? 'UNCONFIGURED' : document.elements.length ? 'CONFIGURED' : 'EMPTY',
    spatialReference: 'ILLUSTRATIVE_NORMALIZED', isGeoreferenced: false,
    elements: document?.elements || [], updatedAt: document?.updatedAt || null, canEdit };
}
