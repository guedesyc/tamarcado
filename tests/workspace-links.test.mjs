import test from "node:test";
import assert from "node:assert/strict";
import { TRAINING_URL, workspaceLinks, isExternalWorkspaceLink } from "../src/lib/workspace-links.ts";

test("workspace menu includes every professional section and the external training", () => {
  const labels = workspaceLinks.map(([label]) => label);
  assert.equal(new Set(labels).size, labels.length);
  for (const label of ["Início", "Agenda", "Solicitações", "Clientes", "Lista de espera", "Serviços", "Perguntas para clientes", "Financeiro", "Portfólio", "Minha página", "Configurações", "Assinatura", "Treinamento"]) {
    assert.ok(labels.includes(label), `${label} missing from workspace menu`);
  }
  assert.equal(workspaceLinks.at(-1)[1], TRAINING_URL);
  assert.equal(isExternalWorkspaceLink(TRAINING_URL), true);
  assert.equal(isExternalWorkspaceLink("/app"), false);
});
