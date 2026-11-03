import React from 'react';
import { Page } from '../App';
import TaskHome from './shell/TaskHome';

interface MainContentProps {
    navigateTo: (page: Page) => void;
}

/** Home screen: a plain-language list of the tasks this user can do. */
const MainContent: React.FC<MainContentProps> = ({ navigateTo }) => <TaskHome navigateTo={navigateTo} />;

export default MainContent;
