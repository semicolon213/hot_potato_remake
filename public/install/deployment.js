export async function updateOrCreateDeployment(api, scriptId, deploymentId, config) {
  if (deploymentId) {
    try {
      return await api(`projects/${scriptId}/deployments/${deploymentId}`, {
        method: 'PUT',
        body: JSON.stringify({ deploymentConfig: { scriptId, ...config } })
      });
    } catch (error) {
      if (error.status !== 404) throw error;
    }
  }
  return api(`projects/${scriptId}/deployments`, { method: 'POST', body: JSON.stringify(config) });
}
