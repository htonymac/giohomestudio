// GioHomeStudio — Publisher interface
// All platform publishers implement this interface.

export interface PublishInput {
  contentItemId: string;
  mediaPath: string;         // absolute path to video or audio file
  mediaType: "video" | "audio";
  title: string;
  caption: string;
  tags?: string[];
  destinationId?: string;    // platform-specific channel/page ID
}

export interface PublishOutput {
  status: "published" | "failed";
  platform: string;
  postId?: string;
  postUrl?: string;
  error?: string;
}

export interface IPublisher {
  readonly platform: string;
  publish(input: PublishInput): Promise<PublishOutput>;
  isConfigured(): boolean;
}
