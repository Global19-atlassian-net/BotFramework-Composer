// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/** @jsx jsx */
import { jsx } from '@emotion/core';
import { useState, Fragment, useEffect } from 'react';
import { RouteComponentProps } from '@reach/router';
import formatMessage from 'format-message';
import { Dialog, DialogType } from 'office-ui-fabric-react/lib/Dialog';
import { useRecoilValue } from 'recoil';

import { ToolBar, IToolBarItem } from '../../components/ToolBar';
import { OpenConfirmModal } from '../../components/Modal/ConfirmDialog';
import { settingsState, projectIdState, dispatcherState } from '../../recoilModel';

import httpClient from './../../utils/httpUtil';
import { LibraryRef } from './types';
import { ContentHeaderStyle, HeaderText, ContentStyle, contentEditor } from './styles';
import { ImportDialog } from './importDialog';
import { LibraryList } from './libraryList';
import { WorkingModal } from './workingModal';

interface LibraryPageProps extends RouteComponentProps<{}> {
  targetName?: string;
}

const Library: React.FC<LibraryPageProps> = (props) => {
  const [items, setItems] = useState<LibraryRef[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const settings = useRecoilValue(settingsState);
  const projectId = useRecoilValue(projectIdState);

  const [availableLibraries, updateAvailableLibraries] = useState<any[]>([]);

  const [selectedItem, setSelectedItem] = useState<LibraryRef>();
  const [working, setWorking] = useState(false);
  const [addDialogHidden, setAddDialogHidden] = useState(true);
  const { setImportedLibraries, fetchProjectById, setApplicationLevelError } = useRecoilValue(dispatcherState);

  useEffect(() => {
    getLibraries();

    return () => {
      fetchProjectById(projectId);
    };
  }, []);

  useEffect(() => {
    const groups: any[] = [];
    let items: any[] = [];

    items = items.concat(settings.importedLibraries || []).concat(availableLibraries || []);

    setItems(items);

    groups.push({
      key: 'installed',
      name: 'Installed',
      startIndex: 0,
      count: settings.importedLibraries ? settings.importedLibraries.length : 0,
      level: 0,
    });
    groups.push({
      key: 'available',
      name: 'Available',
      startIndex: settings.importedLibraries ? settings.importedLibraries.length : 0,
      count: availableLibraries ? availableLibraries.length : 0,
      level: 0,
    });

    setGroups(groups);
  }, [settings.importedLibraries, availableLibraries]);

  const toolbarItems: IToolBarItem[] = [
    {
      type: 'action',
      text: formatMessage('Import Library'),
      buttonProps: {
        iconProps: {
          iconName: 'Add',
        },
        onClick: () => setAddDialogHidden(false),
      },
      align: 'left',
      dataTestid: 'publishPage-ToolBar-Add',
      disabled: false,
    },
  ];

  const closeDialog = () => {
    setAddDialogHidden(true);
  };

  const importFromWeb = async (packageName, version, isUpdating) => {
    // TODO: check to see if package already exists in this project
    const existing = settings.importedLibraries?.find((l) => l.name === packageName);
    let okToProceed = true;
    if (existing) {
      const title = formatMessage('Update Library');
      const msg = formatMessage(
        'Any changes you made to this library will be lost! Are you sure you want to continue?'
      );
      okToProceed = (await OpenConfirmModal(title, msg)) ? true : false;
    }

    if (okToProceed) {
      closeDialog();
      setWorking(true);
      await importLibrary(packageName, version, isUpdating || false);
      setWorking(false);
    }
  };

  const importLibrary = async (packageName, version, isUpdating) => {
    try {
      const response = await httpClient.post(`/projects/${projectId}/import`, {
        package: packageName,
        version: version,
        isUpdating,
      });

      const payload = response.data;
      console.log('Got results: ', payload);
      const newList = settings.importedLibraries?.slice() || [];
      // if this library exists, update the date and version
      const existing = newList.find((f) => f.name === payload.name);
      if (existing) {
        existing.lastImported = new Date();
        existing.version = payload.installedVersion;
      } else {
        newList.push({
          name: payload.name,
          lastImported: new Date(),
          version: payload.installedVersion,
          location: payload.location,
        });
      }

      await setImportedLibraries(newList);

      // reload modified content -- TODO: HOW TO DO THIS?
      // await fetchProjectById(projectId);
    } catch (err) {
      // TODO: HOW TO DO THIS??
      setApplicationLevelError({
        status: err.response.status,
        message: err.response && err.response.data.message ? err.response.data.message : err,
        summary: 'IMPORT ERROR',
      });
    }
  };

  const getLibraries = async () => {
    try {
      const response = await httpClient.get(`/library`);
      updateAvailableLibraries(response.data);
    } catch (err) {
      setApplicationLevelError({
        status: err.response.status,
        message: err.response && err.response.data.message ? err.response.data.message : err,
        summary: 'LIBRARY ERROR',
      });
    }
  };

  const redownload = async () => {
    return importFromWeb(selectedItem?.name, selectedItem?.version, true);
  };

  const removeLibrary = async () => {
    if (selectedItem) {
      const title = formatMessage('Remove Library');
      const msg = formatMessage(
        'Any changes you made to this library will be lost! In addition, this may leave your bot in a broken state. Are you sure you want to continue?'
      );
      const okToProceed = (await OpenConfirmModal(title, msg)) ? true : false;
      if (okToProceed) {
        closeDialog();
        setWorking(true);
        try {
          const response = await httpClient.post(`/projects/${projectId}/unimport`, {
            package: selectedItem.name,
          });

          // remove the item from settings
          const filtered = settings.importedLibraries.filter((f) => f.name !== response.data.package);

          // persist settings change
          setImportedLibraries(filtered);

          // reload modified content
          // await fetchProjectById(projectId);
        } catch (err) {
          setApplicationLevelError({
            status: err.response.status,
            message: err.response && err.response.data.message ? err.response.data.message : err,
            summary: 'IMPORT ERROR',
          });
        }
        setWorking(false);
      }
    }
  };

  const isInstalled = (item: LibraryRef): boolean => {
    return settings.importedLibraries?.find((l) => l.name === item.name) != undefined;
  };
  const selectItem = (item: LibraryRef | null) => {
    if (item) {
      setSelectedItem(item);
    } else {
      setSelectedItem(undefined);
    }
  };

  return (
    <Fragment>
      <Dialog
        dialogContentProps={{ title: formatMessage('Import a Library'), type: DialogType.normal }}
        hidden={addDialogHidden}
        minWidth={450}
        modalProps={{ isBlocking: true }}
        onDismiss={closeDialog}
      >
        <ImportDialog closeDialog={closeDialog} doImport={importFromWeb} />
      </Dialog>
      <WorkingModal hidden={!working} title={formatMessage('Importing library...')} />
      <ToolBar toolbarItems={toolbarItems} />
      <div css={ContentHeaderStyle}>
        <h1 css={HeaderText}>{formatMessage('Asset Library')}</h1>
      </div>
      <div css={ContentStyle} data-testid="installedLibraries" role="main">
        <div aria-label={formatMessage('List view')} css={contentEditor} role="region">
          <Fragment>
            <LibraryList
              groups={groups}
              isInstalled={isInstalled}
              items={items}
              redownload={redownload}
              removeLibrary={removeLibrary}
              updateItems={setItems}
              onItemClick={selectItem}
            />
            {!items || items.length === 0 ? (
              <div style={{ marginLeft: '50px', fontSize: 'smaller', marginTop: '20px' }}>No libraries installed</div>
            ) : null}
          </Fragment>
        </div>
      </div>
    </Fragment>
  );
};

export default Library;