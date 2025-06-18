
import React from 'react';
import { SitemapIcon, LeadsIcon, SettingsIcon, ChatBubbleLeftRightIcon, UsersIcon } from '@/components/common/Icons'; // Added UsersIcon for potential example
import { Button } from '@/components/common/Button';

export const WorkflowsPage: React.FC = () => {
  return (
    <div>
      <div className="flex items-center mb-6">
        <SitemapIcon className="h-8 w-8 text-primary-600 mr-3" />
        <h1 className="text-3xl font-bold text-secondary-900">Workflows & Automation</h1>
      </div>
      <p className="text-secondary-600 mb-8 text-lg">
        Automate repetitive tasks and streamline your business processes across sales, marketing, and operations. Define custom triggers and actions to ensure consistency and efficiency.
      </p>

       <div className="p-8 bg-gradient-to-r from-primary-50 to-indigo-50 border-2 border-dashed border-primary-300 rounded-xl text-center mb-12 shadow-lg">
        <SitemapIcon className="h-16 w-16 text-primary-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-primary-700 mb-3">Advanced Workflow Engine: Coming Soon!</h2>
        <p className="text-primary-600 mt-2 max-w-3xl mx-auto text-md">
          We are actively architecting a robust and intuitive workflow automation engine. Our goal is to provide you with a powerful visual builder where you can:
        </p>
        <ul className="list-disc list-inside text-left max-w-2xl mx-auto mt-4 text-primary-600 space-y-1">
            <li>Design multi-step workflows with conditional logic (if/then/else).</li>
            <li>Set up triggers based on record creation/updates, time-based events, or specific field changes across any module.</li>
            <li>Automate actions like sending emails, creating tasks, updating record statuses, assigning owners, and much more.</li>
            <li>Integrate with external services (future capability).</li>
        </ul>
        <p className="text-primary-500 mt-6 text-sm font-semibold">
          Stay tuned for these exciting updates that will empower you to automate complex business processes with ease!
        </p>
      </div>

      <h2 className="text-2xl font-semibold text-secondary-800 mb-6 text-center">Example Use Cases (Future Capabilities)</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <WorkflowCategoryCard
          title="Lead Nurturing & Assignment"
          description="Automatically assign new leads to sales reps based on territory or round-robin. Send a series of welcome emails. Create follow-up tasks if a lead status doesn't change after X days."
          icon={<LeadsIcon className="h-10 w-10 mb-3 text-primary-500" />}
        />
        <WorkflowCategoryCard
          title="Deal Progression Automation"
          description="When a deal moves to 'Proposal Sent', schedule a follow-up task. If a deal is 'Won', notify the finance team and update related records."
           icon={<SettingsIcon className="h-10 w-10 mb-3 text-green-500" />}
        />
        <WorkflowCategoryCard
          title="Task & User Management"
          description="When a high-priority task is assigned to a user, send them an instant notification. If a user's role changes, automatically update their access permissions (conceptual)."
          icon={<UsersIcon className="h-10 w-10 mb-3 text-blue-500" />}
        />
         <WorkflowCategoryCard
          title="Customer Onboarding"
          description="Once a deal is won, trigger a workflow to create a new customer project, assign an account manager, and send a welcome package email."
           icon={<SitemapIcon className="h-10 w-10 mb-3 text-yellow-500" />}
        />
         <WorkflowCategoryCard
          title="Support Ticket Escalation"
          description="If a support ticket with 'Urgent' priority isn't addressed within 1 hour, automatically escalate it to a senior support agent or manager."
          icon={<ChatBubbleLeftRightIcon className="h-10 w-10 mb-3 text-indigo-500" />}
        />
         <WorkflowCategoryCard
          title="Data Hygiene Automation"
          description="Periodically check for leads or contacts with missing critical information and create tasks for data enrichment."
           icon={<SettingsIcon className="h-10 w-10 mb-3 text-teal-500" />}
        />
      </div>
      
    </div>
  );
};

const WorkflowCategoryCard: React.FC<{title: string, description: string, icon: React.ReactNode}> = ({ title, description, icon }) => (
  <div className="bg-white p-6 rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col items-center text-center h-full border-t-4 border-primary-500">
    {icon}
    <h3 className="text-xl font-semibold text-secondary-800 mb-2">{title}</h3>
    <p className="text-sm text-secondary-600 flex-grow mb-4">{description}</p>
    <Button variant="outline" size="sm" className="w-full mt-auto cursor-not-allowed opacity-70" disabled title="Configuration coming soon">
      Configure (Coming Soon)
    </Button>
  </div>
);

