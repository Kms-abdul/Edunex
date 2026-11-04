import React from 'react';
import { Page } from '../App';
import SchoolOverview from './shell/SchoolOverview';

interface MainContentProps {
    navigateTo: (page: Page) => void;
}

/** Home screen: live information about the school (students, attendance, fees, staff, what's coming up). */
const MainContent: React.FC<MainContentProps> = () => <SchoolOverview />;

export default MainContent;
