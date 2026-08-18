# One-way annotations, read-on-drain, no reply threads

Annotations travel one way: reader → agent. The agent answers in its own chat surface (where the user is already sitting), referencing the annotation's quote and heading trail. The doc shows the agent's *work* via live-reload; it does not host a conversation. Statuses are mechanical: `unread` → `read` when an agent drains the queue (`margin list --unread`); the reader may manually `dismiss` a handled note. Margin never infers resolution.

Rejected: in-doc reply threads, a `margin reply` verb, and `resolved-by-edit` states. That is a messaging system — scope creep for an annotation tool, and it duplicates the record the chat already keeps. Cut deliberately; revisit only if the chat-as-reply-channel proves lossy in practice.
