import nlp from 'compromise';
import { AuditResult, AuditContext } from '../../types/index.js';

export function auditNamedEntities(ctx: AuditContext): AuditResult {
  const doc = nlp(ctx.text);

  const people = doc.people().out('array') as string[];
  const organizations = doc.organizations().out('array') as string[];
  const places = doc.places().out('array') as string[];

  const uniquePeople = [...new Set(people.map((p) => p.trim()).filter(Boolean))];
  const uniqueOrgs = [...new Set(organizations.map((o) => o.trim()).filter(Boolean))];
  const uniquePlaces = [...new Set(places.map((p) => p.trim()).filter(Boolean))];

  const typesPresent = [
    uniquePeople.length > 0 && 'people',
    uniqueOrgs.length > 0 && 'organizations',
    uniquePlaces.length > 0 && 'places',
  ].filter(Boolean) as string[];

  const passes = typesPresent.length >= 2;

  const found: string[] = [];
  if (uniquePeople.length > 0)
    found.push(`People: ${uniquePeople.slice(0, 3).join(', ')}`);
  if (uniqueOrgs.length > 0)
    found.push(`Organizations: ${uniqueOrgs.slice(0, 3).join(', ')}`);
  if (uniquePlaces.length > 0)
    found.push(`Places: ${uniquePlaces.slice(0, 3).join(', ')}`);

  const missing: string[] = [];
  if (uniquePeople.length === 0) missing.push('people');
  if (uniqueOrgs.length === 0) missing.push('organizations');
  if (uniquePlaces.length === 0) missing.push('places');

  return {
    id: 'named_entities',
    category: 'aeo',
    title: 'Named entity coverage',
    status: passes ? 'pass' : 'fail',
    weight: 1.0,
    score: passes ? 1 : 0,
    evidence: passes
      ? `Found entities across ${typesPresent.length} types. ${found.join(' | ')}`
      : `Weak named entity coverage — only ${typesPresent.length} entity type(s) detected. ${found.length > 0 ? found.join(' | ') + '.' : ''} Missing: ${missing.join(', ')}.`,
  };
}
