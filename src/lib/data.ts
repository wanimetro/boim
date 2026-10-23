// Compatibility facade. New code imports the service/domain modules directly.
export { teamByToken, teamByInvite, membersOf, tasksOf, teamsOfUser, newInviteCode, createTeam, joinTeam, logView } from "@/server/services/team-service";
export type { Status, Review, Team, Member, Submission, Task } from "@/domain/task";
export { statusOf } from "@/domain/task";
