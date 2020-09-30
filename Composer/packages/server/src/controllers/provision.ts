// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import { ExtensionContext } from '@bfc/extension';

import { BotProjectService } from '../services/project';

const defaultPublishConfig = {
  name: 'default',
  type: 'localpublish',
  provisionConfig: '',
  configuration: JSON.stringify({}),
};

export const ProvisionController = {
  provision: async (req, res) => {
    // TODO: This should pull the token from the header using the same mechanism as the other features.
    if (!req.body || !req.body.accessToken || !req.body.graphToken) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    const user = await ExtensionContext.getUserFromRequest(req);
    const { type } = req.body; // type is webapp or functions
    const projectId = req.params.projectId;
    const currentProject = await BotProjectService.getProjectById(projectId, user);
    // deal with publishTargets not exist in settings
    // const publishTargets = currentProject.settings?.publishTargets || [];

    if (ExtensionContext?.extensions?.publish[type]?.methods?.provision) {
      // get the externally provision method
      const pluginMethod = ExtensionContext.extensions.publish[type].methods.provision;

      try {
        // call the method
        const result = await pluginMethod.call(null, req.body, currentProject, user);
        // set status and return value as json
        res.status(result.status).json(result);
      } catch (err) {
        console.log(err);
        res.status(400).json({
          statusCode: '400',
          message: err.message,
        });
      }
    }
  },
  // provision: async (req, res) => {
  //   if (!req.body || !req.body.accessToken || !req.body.graphToken) {
  //     res.status(401).json({ message: 'Unauthorized' });
  //     return;
  //   }
  //   // const user = await PluginLoader.getUserFromRequest(req);
  //   const { type } = req.body; // type is webapp or functions
  //   // const projectId = req.params.projectId;
  //   // const currentProject = await BotProjectService.getProjectById(projectId, user);
  //   // deal with publishTargets not exist in settings
  //   // const publishTargets = currentProject.settings?.publishTargets || [];

  //   if (pluginLoader?.extensions?.publish[type]?.methods?.provision) {
  //     // get the externally provision method
  //     // const pluginMethod = pluginLoader.extensions.publish[type].methods.provision;

  //     try {
  //       // call the method
  //       // const result = await pluginMethod.call(null, req.body, currentProject, user);
  //       // set status and return value as json
  //       // res.status(result.status).json({
  //       //   config: result.config,
  //       //   details: result.details,
  //       // });
  //       res.status(202).json({
  //         config: null,
  //         details: {},
  //       });
  //     } catch (err) {
  //       console.log(err);
  //       res.status(400).json({
  //         statusCode: '400',
  //         message: err.message,
  //       });
  //     }
  //   }
  // },

  getProvisionStatus: async (req, res) => {
    const target = req.params.target;
    const user = await ExtensionContext.getUserFromRequest(req);
    const projectId = req.params.projectId;
    const currentProject = await BotProjectService.getProjectById(projectId, user);

    const publishTargets = currentProject.settings?.publishTargets || [];
    const allTargets = [defaultPublishConfig, ...publishTargets];

    const profiles = allTargets.filter((t) => t.name === target);
    const profile = profiles.length ? profiles[0] : undefined;

    const method = profile ? profile.type : undefined;

    if (profile && method && ExtensionContext?.extensions?.publish[method]?.methods?.getProvisionStatus) {
      // get the externally defined method
      const pluginMethod = ExtensionContext.extensions.publish[method].methods.getProvisionStatus;
      const provisionConfig = profile.provisionConfig || '{}';
      try {
        // call the method
        const result = await pluginMethod.call(null, JSON.parse(provisionConfig), currentProject, user);
        // set status and return value as json
        res.status(result.status).json({
          ...result,
          config: result.config || null,
          details: result.details || {},
        });
      } catch (err) {
        console.log(err);
        res.status(400).json({
          statusCode: '400',
          message: err.message,
        });
      }
    }
  },
};