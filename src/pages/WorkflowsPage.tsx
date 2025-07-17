
import React from 'react';
import { SitemapIcon, LeadsIcon, TagIcon, ClipboardDocumentCheckIcon } from '@/components/common/Icons'; 

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
           icon={<TagIcon className="h-10 w-10 mb-3 text-green-500" />}
        />
        <WorkflowCategoryCard
          title="Task & User Management"
          description="When a high-priority task is assigned, send an immediate notification to the assignee. When a user's role changes, automatically update their access permissions to related records."
           icon={<ClipboardDocumentCheckIcon className="h-10 w-10 mb-3 text-yellow-500" />}
        />
      </div>
    </div>
  );
};

const WorkflowCategoryCard: React.FC<{title: string, description: string, icon: React.ReactNode}> = ({title, description, icon}) => (
    <div className="bg-white p-6 rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col items-center text-center">
        {icon}
        <h3 className="text-xl font-semibold text-secondary-800 mb-2">{title}</h3>
        <p className="text-secondary-600 text-sm">{description}</p>
    </div>
)
