// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/** @jsx jsx */
import React, { useEffect, useRef, useState, Fragment } from 'react';
import { jsx, css } from '@emotion/core';
import formatMessage from 'format-message';
import { FontSizes, FontWeights } from 'office-ui-fabric-react/lib/Styling';
import { Dropdown } from 'office-ui-fabric-react/lib/Dropdown';
import { Toggle } from 'office-ui-fabric-react/lib/Toggle';
import { useRecoilValue } from 'recoil';

import { settingsState } from '../../recoilModel';
import { CollapsableWrapper } from '../../components/CollapsableWrapper';
import { AuthClient } from '../../utils/authClient';
import { AuthDialog } from '../../components/Auth/AuthDialog';
import { armScopes } from '../../constants';
import { getTokenFromCache, isShowAuthDialog, isGetTokenFromUser } from '../../utils/auth';
import httpClient from '../../utils/httpUtil';

// -------------------- Styles -------------------- //

const titleStyle = css`
  font-size: ${FontSizes.medium};
  font-weight: ${FontWeights.semibold};
  margin-left: 22px;
  margin-top: 6px;
`;

// -------------------- RuntimeSettings -------------------- //

const CHANNELS = {
  TEAMS: 'MsTeamsChannel',
  WEBCHAT: 'WebChatChannel',
  SPEECH: 'DirectLineSpeechChannel',
};

type RuntimeSettingsProps = {
  projectId: string;
  scrollToSectionId?: string;
};

type AzureResourcePointer = {
  subscriptionId: string | undefined;
  resourceName: string;
  resourceGroupName: string;
};

type AzureChannelStatus = {
  enabled: boolean;
  configured: boolean;
  data: {
    [key: string]: any;
  };
};

type AzureChannelsStatus = {
  [key: string]: AzureChannelStatus;
};

export const ABSChannels: React.FC<RuntimeSettingsProps> = (props) => {
  const { projectId, scrollToSectionId } = props;
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [currentResource, setCurrentResource] = useState<AzureResourcePointer | undefined>();
  const [channelStatus, setChannelStatus] = useState<AzureChannelsStatus | undefined>();
  const { publishTargets } = useRecoilValue(settingsState(projectId));
  const [token, setToken] = useState<string | undefined>();
  const containerRef = useRef<HTMLDivElement>(null);

  const onSelectProfile = async (evt, opt, index) => {
    console.log('SELETED', opt);
    let newtoken = '';
    if (isGetTokenFromUser()) {
      if (isShowAuthDialog(false)) {
        setShowAuthDialog(true);
      }
      newtoken = getTokenFromCache('accessToken');
    } else {
      newtoken = await AuthClient.getAccessToken(armScopes);
    }
    setToken(newtoken);
    console.log('GOT A TOKEN', newtoken);

    // identify the publishing profile in the list
    const profile = publishTargets?.find((p) => p.name === opt.key);
    if (profile) {
      const config = JSON.parse(profile.configuration);
      setCurrentResource({
        resourceName: config.name,
        resourceGroupName: config.name,
        subscriptionId: config.subscriptionId,
      });
    }
  };

  useEffect(() => {
    console.log('current resource changed!', currentResource);
    if (currentResource && !currentResource.subscriptionId) {
      // fetch list of available subscriptions
      alert('load subscription list');
    } else if (currentResource) {
      console.log('check on status...');
      // we already know everything we need to make the call...
      updateChannelStatus();
    } else {
      // do nothing...
      console.log('do nothing with', currentResource);
    }
  }, [currentResource]);

  useEffect(() => {
    console.log('channel status changed', channelStatus);
  }, [channelStatus]);

  const fetchChannelStatus = async (channelId: string) => {
    if (currentResource) {
      try {
        const url = `https://management.azure.com/subscriptions/${currentResource.subscriptionId}/resourceGroups/${currentResource?.resourceGroupName}/providers/Microsoft.BotService/botServices/${currentResource?.resourceName}/channels/${channelId}?api-version=2020-06-02`;
        const res = await httpClient.get(url, { headers: { Authorization: `Bearer ${token}` } });
        console.log(`status of ${channelId}`, channelId, res.data);
        return {
          enabled: true,
          configured: true,
          data: res.data,
        };
      } catch (err) {
        switch (err?.response.data?.error.code) {
          case 'AuthenticationFailed':
            // the auth failed for some reason.
            break;
          case 'ResourceNotFound':
            // this channel has not yet been created, should display as disabled
            console.log('RESOURCe NOT FOUND == NOT ENABLED, RETURN FALSE');
            return {
              enabled: false,
              configured: false,
              data: {},
            };
            break;
          case 'ResourceGroupNotFound':
            // this resource group is not found - in other words, can't find a channel registration in the expected spot.
            break;
          case 'SubscriptionNotFound':
            // the subscription is not found or invalid
            break;
          default:
            // handle error.
            break;
        }
        throw new Error(`Failed to retrieve status for ${channelId} ${err?.data?.error.message}`);
      }
    }
  };

  const createChannelService = async (channelId: string) => {
    try {
      const url = `https://management.azure.com/subscriptions/${currentResource?.subscriptionId}/resourceGroups/${currentResource?.resourceGroupName}/providers/Microsoft.BotService/botServices/${currentResource?.resourceName}/channels/${channelId}?api-version=2020-06-02`;
      let data = {};
      switch (channelId) {
        case CHANNELS.TEAMS:
          data = {
            location: 'global',
            name: `${currentResource?.resourceName}/${channelId}`,
            properties: {
              channelName: channelId,
              location: 'global',
              properties: {
                // enableCalling: false,
                isEnabled: true,
                // callingWebhook: null,
                // deploymentEnvironment: 0,
                // incomingCallRoute: 'graphPma',
              },
            },
          };
          break;
        case CHANNELS.WEBCHAT:
          data = {
            name: `${currentResource?.resourceName}/${channelId}`,
            type: 'Microsoft.BotService/botServices/channels',
            location: 'global',
            properties: {
              properties: {
                webChatEmbedCode: null,
                sites: [
                  {
                    siteName: 'Default Site',
                    isEnabled: true,
                    isWebchatPreviewEnabled: true,
                  },
                ],
              },
              channelName: 'WebChatChannel',
              location: 'global',
            },
          };
          break;
        case CHANNELS.SPEECH:
          data = {
            name: `${currentResource?.resourceName}/${channelId}`,
            type: 'Microsoft.BotService/botServices/channels',
            location: 'global',
            properties: {
              properties: {
                cognitiveServiceRegion: null,
                cognitiveServiceSubscriptionKey: null,
                isEnabled: true,
                customVoiceDeploymentId: '',
                customSpeechModelId: '',
                isDefaultBotForCogSvcAccount: false,
              },
              channelName: 'DirectLineSpeechChannel',
              location: 'global',
            },
          };
      }
      const res = await httpClient.put(url, data, { headers: { Authorization: `Bearer ${token}` } });

      // success!!
      setChannelStatus({
        ...channelStatus,
        [channelId]: {
          enabled: true,
          configured: true,
          data: res.data,
        },
      });

      console.log(`status of ${channelId}`, channelId, res.data);
      return {
        enabled: res.data.properties.properties.isEnabled,
        configured: true,
      };
    } catch (err) {
      switch (err?.response.data?.error.code) {
        case 'AuthenticationFailed':
          // the auth failed for some reason.
          break;
        case 'ResourceGroupNotFound':
          // this resource group is not found - in other words, can't find a channel registration in the expected spot.
          break;
        case 'SubscriptionNotFound':
          // the subscription is not found or invalid
          break;
        default:
          // handle error.
          break;
      }
      throw new Error(`Failed to retrieve status for ${channelId} ${err?.data?.error.message}`);
    }
  };

  const deleteChannelService = async (channelId: string) => {
    try {
      const url = `https://management.azure.com/subscriptions/${currentResource?.subscriptionId}/resourceGroups/${currentResource?.resourceGroupName}/providers/Microsoft.BotService/botServices/${currentResource?.resourceName}/channels/${channelId}?api-version=2020-06-02`;
      const res = await httpClient.delete(url, { headers: { Authorization: `Bearer ${token}` } });

      console.log('DELETE COMPLETED', res);

      // success!!
      setChannelStatus({
        ...channelStatus,
        [channelId]: {
          enabled: false,
          configured: false,
          data: {},
        },
      });
    } catch (err) {
      switch (err?.response.data?.error.code) {
        case 'AuthenticationFailed':
          // the auth failed for some reason.
          break;

        case 'ResourceGroupNotFound':
          // this resource group is not found - in other words, can't find a channel registration in the expected spot.
          break;

        case 'SubscriptionNotFound':
          // the subscription is not found or invalid
          break;

        default:
          // handle error.
          break;
      }
      throw new Error(`Failed to retrieve status for ${channelId} ${err?.data?.error.message}`);
    }
  };

  const updateChannelStatus = async () => {
    // there is a chance subscriptionId is blank.
    console.log('update channelSTatus of ', currentResource);
    if (currentResource?.subscriptionId) {
      // NOW, call ARM api to determine status of each channel...
      // Swagger file for this is here: https://raw.githubusercontent.com/Azure/azure-rest-api-specs/master/specification/botservice/resource-manager/Microsoft.BotService/stable/2020-06-02/botservice.json
      try {
        const teams = await fetchChannelStatus(CHANNELS.TEAMS);
        const webchat = await fetchChannelStatus(CHANNELS.WEBCHAT);
        const speech = await fetchChannelStatus(CHANNELS.SPEECH);

        if (teams && webchat && speech) {
          console.log({ teams, webchat, speech });
          setChannelStatus({
            [CHANNELS.TEAMS]: teams,
            [CHANNELS.WEBCHAT]: webchat,
            [CHANNELS.SPEECH]: speech,
          });
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  const hasAuth = () => {
    console.log('rEADY TO GO');
  };

  const toggleTeams = async (evt, enabled) => {
    console.log('toggle tams to', enabled, channelStatus?.[CHANNELS.TEAMS]);
    if (enabled) {
      // create the teams service and turn it on
      console.log('CREATE A NEW SERVICE');
      await createChannelService(CHANNELS.TEAMS);
    } else {
      // enable an already existing service
      console.log('DISABLE AN EXISTING SERVICE');
      await deleteChannelService(CHANNELS.TEAMS);
    }
  };

  const toggleWebchat = async (evt, enabled) => {
    console.log('toggle webchat to', enabled, channelStatus?.[CHANNELS.WEBCHAT]);
    if (enabled) {
      // create the teams service and turn it on
      console.log('CREATE A NEW SERVICE');
      await createChannelService(CHANNELS.WEBCHAT);
    } else {
      console.log('DISABLE AN EXISTING SERVICE');
      await deleteChannelService(CHANNELS.WEBCHAT);
    }
  };

  const toggleSpeech = async (evt, enabled) => {
    console.log('toggle SPEECH to', enabled, channelStatus?.[CHANNELS.SPEECH]);
    if (enabled) {
      // create the teams service and turn it on
      console.log('CREATE A NEW SERVICE');
      await createChannelService(CHANNELS.SPEECH);
    } else {
      console.log('DISABLE AN EXISTING SERVICE');
      await deleteChannelService(CHANNELS.SPEECH);
    }
  };

  useEffect(() => {
    if (containerRef.current && scrollToSectionId === '#runtimeSettings') {
      containerRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [scrollToSectionId]);

  return (
    <CollapsableWrapper title={formatMessage('Azure Bot Service Connections')} titleStyle={titleStyle}>
      {showAuthDialog && (
        <AuthDialog
          needGraph={false}
          next={hasAuth}
          onDismiss={() => {
            setShowAuthDialog(false);
          }}
        />
      )}
      <div ref={containerRef}>
        <Dropdown
          options={
            publishTargets?.map((p) => {
              return { key: p.name, text: p.name };
            }) || []
          }
          placeholder={formatMessage('Choose publishing profile')}
          onChange={onSelectProfile}
        />

        {currentResource && channelStatus && (
          <Fragment>
            MS Teams
            <Toggle
              inlineLabel
              checked={channelStatus[CHANNELS.TEAMS].enabled}
              // label={formatMessage('Use custom runtime')}
              onChange={toggleTeams}
            />
            Webchat
            <Toggle inlineLabel checked={channelStatus[CHANNELS.WEBCHAT].enabled} onChange={toggleWebchat} />
            Speech
            <Toggle inlineLabel checked={channelStatus[CHANNELS.SPEECH].enabled} onChange={toggleSpeech} />
          </Fragment>
        )}
      </div>
    </CollapsableWrapper>
  );
};
