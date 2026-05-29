import { getProvider } from "@/lib/providers";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { SessionsTable } from "@/components/dashboard/sessions-table";

export default async function SessionsPage() {
  const sessions = await getProvider().listSessions();

  return (
    <>
      <PageHeader
        title="Sessions"
        subtitle="Every agent session across all workspaces."
        icon="MessageSquare"
      />
      <Card>
        <CardBody className="px-0 py-0">
          <SessionsTable sessions={sessions} />
        </CardBody>
      </Card>
    </>
  );
}
